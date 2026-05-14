import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Sparkles,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import {
  parseMerukiListScreenshot,
  importParsedOrders,
} from "@/lib/meruki-parse.functions";

export const Route = createFileRoute("/purchase/japan-parcel/import")({
  head: () => ({ meta: [{ title: "截图批量导入 · BOOMER OFF" }] }),
  component: ImportPage,
});

type ParsedOrder = {
  source_order_no?: string | null;
  item_title?: string | null;
  item_title_cn?: string | null;
  seller?: string | null;
  total_jpy?: number | null;
  price_jpy?: number | null;
  purchased_at?: string | null;
  status_text?: string | null;
  status?: string;
  already_exists?: boolean;
  // raw passthrough for import
  [key: string]: unknown;
};

type ImageItem = {
  id: string;
  dataUrl: string;
  state: "pending" | "parsing" | "done" | "error";
  reason?: string;
  orders: ParsedOrder[];
};

function ImportPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const parse = useServerFn(parseMerukiListScreenshot);
  const importFn = useServerFn(importParsedOrders);

  const [items, setItems] = useState<ImageItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const allOrders: { itemId: string; index: number; order: ParsedOrder }[] =
    items.flatMap((it) =>
      it.orders.map((o, index) => ({ itemId: it.id, index, order: o })),
    );

  const keyOf = (itemId: string, index: number) => `${itemId}::${index}`;

  const addFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newItems: ImageItem[] = await Promise.all(
      arr.map(
        (f) =>
          new Promise<ImageItem>((resolve) => {
            const r = new FileReader();
            r.onload = () =>
              resolve({
                id: crypto.randomUUID(),
                dataUrl: String(r.result),
                state: "pending",
                orders: [],
              });
            r.readAsDataURL(f);
          }),
      ),
    );
    setItems((prev) => [...prev, ...newItems]);
    // Auto-parse each
    newItems.forEach((it) => parseOne(it));
  };

  const parseOne = async (item: ImageItem) => {
    setItems((prev) =>
      prev.map((x) => (x.id === item.id ? { ...x, state: "parsing" } : x)),
    );
    try {
      const r = await parse({
        data: { image_base64: item.dataUrl, mime_type: "image/png" },
      });
      if (!r.ok) {
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, state: "error", reason: r.reason } : x,
          ),
        );
        return;
      }
      const orders = r.orders as ParsedOrder[];
      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, state: "done", orders } : x)),
      );
      // Default-select new (not-yet-existing) orders
      setSelected((prev) => {
        const next = { ...prev };
        orders.forEach((o, index) => {
          next[keyOf(item.id, index)] = !o.already_exists && !!o.source_order_no;
        });
        return next;
      });
    } catch (e) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? { ...x, state: "error", reason: (e as Error).message }
            : x,
        ),
      );
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const importMut = useMutation({
    mutationFn: () => {
      const chosen = allOrders
        .filter(({ itemId, index }) => selected[keyOf(itemId, index)])
        .map(({ order }) => ({
          source_order_no: order.source_order_no ?? null,
          item_title: order.item_title ?? null,
          item_title_cn: order.item_title_cn ?? null,
          item_image_url: (order.item_image_url as string | null) ?? null,
          seller: order.seller ?? null,
          price_jpy: order.price_jpy ?? null,
          service_fee_jpy: (order.service_fee_jpy as number | null) ?? null,
          domestic_freight_jpy:
            (order.domestic_freight_jpy as number | null) ?? null,
          intl_freight_jpy: (order.intl_freight_jpy as number | null) ?? null,
          total_jpy: order.total_jpy ?? null,
          weight_g: (order.weight_g as number | null) ?? null,
          warehouse_location:
            (order.warehouse_location as string | null) ?? null,
          tracking_no: (order.tracking_no as string | null) ?? null,
          purchased_at: order.purchased_at ?? null,
          status: order.status ?? "purchased",
          notes: (order.notes as string | null) ?? null,
        }));
      return importFn({ data: { orders: chosen } });
    },
    onSuccess: (r) => {
      toast.success(`导入完成：新增 ${r.inserted}，跳过 ${r.skipped}`);
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
      nav({ to: "/purchase/japan-parcel" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalParsed = allOrders.length;

  return (
    <div>
      <PageHeader
        title="截图批量导入"
        description="用浏览器全屏截图插件抓 meruki 订单列表 → 拖到下面 → AI 自动解析 → 勾选导入"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => nav({ to: "/purchase/japan-parcel" })}
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> 返回
            </Button>
            <Button
              size="sm"
              className="bg-gradient-brand hover:opacity-90"
              disabled={selectedCount === 0 || importMut.isPending}
              onClick={() => importMut.mutate()}
            >
              {importMut.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              导入选中 ({selectedCount})
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="py-5">
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">📌 推荐截图工具</p>
            <ul className="list-disc space-y-0.5 pl-5">
              <li>
                <b>GoFullPage</b>（Chrome/Edge 商店搜索安装，最推荐）— 一键把整页订单列表拼成一张 PNG
              </li>
              <li>
                <b>FireShot</b> / <b>Awesome Screenshot</b>— 同类全屏截图插件
              </li>
            </ul>
            <p className="mt-2">
              员工日常 SOP：打开 meruki 订单列表 → 点截图插件 → 把保存的图直接拖到下方，或粘贴
              (<kbd className="rounded border bg-background px-1">Ctrl/⌘+V</kbd>) 也行。
            </p>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center hover:border-primary/50 hover:bg-muted/30"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">拖入一张或多张订单截图</p>
            <p className="text-xs text-muted-foreground">支持 PNG / JPG，可一次选多张</p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card className="mb-4">
          <CardContent className="grid grid-cols-2 gap-3 py-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((it) => (
              <div key={it.id} className="relative rounded-md border p-2">
                <img
                  src={it.dataUrl}
                  alt=""
                  className="h-24 w-full rounded object-cover"
                />
                <div className="mt-1.5 flex items-center justify-between text-xs">
                  {it.state === "parsing" && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> 解析中
                    </span>
                  )}
                  {it.state === "done" && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> {it.orders.length} 条
                    </span>
                  )}
                  {it.state === "error" && (
                    <span
                      className="flex items-center gap-1 text-destructive"
                      title={it.reason}
                    >
                      <XCircle className="h-3 w-3" /> 失败
                    </span>
                  )}
                  {it.state === "pending" && (
                    <span className="text-muted-foreground">等待…</span>
                  )}
                  <button
                    onClick={() => removeItem(it.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {totalParsed > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
              <div>
                共解析出 <b>{totalParsed}</b> 条订单 · 已选 <b>{selectedCount}</b> 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    allOrders.forEach(({ itemId, index, order }) => {
                      all[keyOf(itemId, index)] =
                        !order.already_exists && !!order.source_order_no;
                    });
                    setSelected(all);
                  }}
                >
                  仅选新单
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected({})}
                >
                  清空选择
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>订单号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>卖家</TableHead>
                  <TableHead className="text-right">金额 ¥</TableHead>
                  <TableHead>状态文本</TableHead>
                  <TableHead className="text-center">情况</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allOrders.map(({ itemId, index, order }) => {
                  const k = keyOf(itemId, index);
                  return (
                    <TableRow key={k}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[k]}
                          onCheckedChange={(v) =>
                            setSelected((p) => ({ ...p, [k]: !!v }))
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.source_order_no || (
                          <span className="text-destructive">缺单号</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm">
                        {order.item_title || order.item_title_cn || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{order.seller || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {order.total_jpy != null
                          ? `¥${Number(order.total_jpy).toLocaleString()}`
                          : order.price_jpy != null
                            ? `¥${Number(order.price_jpy).toLocaleString()}`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {order.status_text || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.already_exists ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            已存在
                          </span>
                        ) : !order.source_order_no ? (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                            无效
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            新订单
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {items.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          也可以走旧的{" "}
          <Link
            to="/purchase/japan-parcel/new"
            search={{ tab: "ai" as const }}
            className="underline"
          >
            单条 AI 识图
          </Link>
          {" "}或{" "}
          <Link to="/purchase/japan-parcel/new" className="underline">
            手动新建
          </Link>
          。
        </p>
      )}
    </div>
  );
}
