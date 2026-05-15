import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  Filter,
  
  Trash2,
  Pencil,
  CheckCircle2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  PARCEL_SOURCE_LABEL,
  simplifyStatus,
  SIMPLE_STATUS_LABEL,
  getDisplayTitle,
  type SimpleStatus,
} from "@/lib/japan-parcel.helpers";
import {
  listJapanParcels,
  updateJapanParcelStatus,
  updateJapanParcel,
  deleteJapanParcel,
  bulkDeleteJapanParcels,
} from "@/lib/japan-parcel.functions";
import { useDebounced } from "@/hooks/use-debounced";
import type { ParcelCardData, ParcelCardItem } from "@/components/japan-parcel/parcel-card-dialog";
import { ItemsHoverPreview } from "@/components/japan-parcel/items-hover-preview";

const ParcelCardDialog = lazy(() =>
  import("@/components/japan-parcel/parcel-card-dialog").then((m) => ({
    default: m.ParcelCardDialog,
  })),
);

const buildListKey = (search: string, sources: string[]) =>
  ["jp-parcels", { search, sources }] as const;

const listOptions = (search: string, sources: string[]) => ({
  queryKey: buildListKey(search, sources),
  queryFn: () =>
    listJapanParcels({
      data: { search, source: sources.length ? sources : undefined },
    }),
  staleTime: 60_000,
  refetchOnWindowFocus: false,
});

export const Route = createFileRoute("/purchase/japan-parcel/")({
  head: () => ({
    meta: [
      { title: "日本小包裹 · BOOMER OFF" },
      { name: "description", content: "Meruki / Yahoo / Mercari 小包裹订单管理" },
    ],
  }),
  component: JapanParcelList,
});

type ItemRow = {
  id: string;
  item_title: string | null;
  item_title_cn: string | null;
  item_image_url: string | null;
  item_total_jpy: number | null;
  item_total_cny: number | null;
  weight_g: number | null;
  unit_price_jpy?: number | null;
  quantity?: number | null;
  sub_order_no?: string | null;
};

type ParcelRow = ParcelCardData & {
  source: string;
  item_title: string | null;
  item_title_cn: string | null;
  item_image_url: string | null;
  total_jpy: number | null;
  tariff_cny?: number | null;
  japan_parcel_items?: ItemRow[];
};

type ListData = { rows: ParcelRow[] };

function JapanParcelList() {
  const qc = useQueryClient();
  const router = useRouter();
  const updateStatus = useServerFn(updateJapanParcelStatus);
  const updateParcel = useServerFn(updateJapanParcel);
  const delOne = useServerFn(deleteJapanParcel);
  const delMany = useServerFn(bulkDeleteJapanParcels);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SimpleStatus[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<"overview" | "edit">("overview");
  const debouncedSearch = useDebounced(search, 300);

  const list = useQuery({
    ...listOptions(debouncedSearch, sources),
    placeholderData: (previousData) => previousData,
  });

  const allRows = (list.data?.rows ?? []) as unknown as ParcelRow[];
  // 客户端按简化状态筛选
  const rows = useMemo(
    () =>
      statusFilter.length
        ? allRows.filter((r) => statusFilter.includes(simplifyStatus(r.status)))
        : allRows,
    [allRows, statusFilter],
  );

  const statusMut = useMutation({
    mutationFn: async (v: { id: string; status: SimpleStatus }) => {
      // 已签收时附带写入 received_at
      if (v.status === "delivered") {
        return updateParcel({
          data: { id: v.id, status: "delivered", received_at: new Date().toISOString() } as never,
        });
      }
      return updateStatus({ data: { id: v.id, status: v.status } });
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["jp-parcels"] });
      const snapshots = qc.getQueriesData<ListData>({ queryKey: ["jp-parcels"] });
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<ListData>(key, {
          ...data,
          rows: data.rows.map((r) => (r.id === v.id ? { ...r, status: v.status } : r)),
        });
      });
      return { snapshots };
    },
    onError: (e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error((e as Error).message);
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "delivered" ? "已标记为已签收" : "已恢复为已采购");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jp-parcels"] }),
  });

  const toggleStatusFilter = (s: SimpleStatus) =>
    setStatusFilter((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  const toggleSource = (v: string) =>
    setSources((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const delMut = useMutation({
    mutationFn: (id: string) => delOne({ data: { id } }),
    onSuccess: () => {
      toast.success("已删除");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const bulkMut = useMutation({
    mutationFn: (ids: string[]) => delMany({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`已删除 ${r.count} 条`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const openParcel = allRows.find((r) => r.id === openCardId) ?? null;

  return (
    <div>
      <PageHeader
        title="日本小包裹"
        description="AI 识图 · 手动录入 · 状态人工维护"
        actions={
          <Button asChild size="sm" className="bg-gradient-brand hover:opacity-90">
            <Link
              to="/purchase/japan-parcel/new"
              onMouseEnter={() => router.preloadRoute({ to: "/purchase/japan-parcel/new" })}
              onPointerDown={() => router.preloadRoute({ to: "/purchase/japan-parcel/new" })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新建包裹
            </Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索订单号 / 标题 / 物流单号"
              className="h-9 pl-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                状态 {statusFilter.length ? `(${statusFilter.length})` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(["purchased", "delivered"] as SimpleStatus[]).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleStatusFilter(s);
                  }}
                >
                  <input type="checkbox" readOnly checked={statusFilter.includes(s)} className="mr-2" />
                  {SIMPLE_STATUS_LABEL[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                来源 {sources.length ? `(${sources.length})` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(PARCEL_SOURCE_LABEL).map(([v, label]) => (
                <DropdownMenuItem
                  key={v}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleSource(v);
                  }}
                >
                  <input type="checkbox" readOnly checked={sources.includes(v)} className="mr-2" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>已选择 {selected.size} 条</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              取消
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkMut.isPending}
              onClick={() => {
                if (confirm(`确认删除选中的 ${selected.size} 条订单？此操作不可恢复。`))
                  bulkMut.mutate(Array.from(selected));
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              批量删除
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {list.isLoading && rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">正在加载小包裹列表…</div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="暂无小包裹订单"
              description="可以单条 AI 识图，或手动新建。"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[36px] text-center">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="全选" />
                  </TableHead>
                  <TableHead className="w-[64px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">图</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">订单 / 标题</TableHead>
                  <TableHead className="w-[60px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">子单</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">合计</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider text-muted-foreground">采购时间</TableHead>
                  <TableHead className="w-[110px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">状态</TableHead>
                  <TableHead className="w-[160px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const items = (r.japan_parcel_items ?? []) as ItemRow[];
                  const subCount = items.length;
                  const subSumJpy = items.reduce((s, it) => s + (Number(it.item_total_jpy) || 0), 0);
                  // 日本侧 JPY 合计 = 商品 + 国际物流（关税不计入 JPY）
                  const fallbackJpy =
                    subSumJpy + (Number(r.intl_total_jpy) || 0);
                  const totalJpy =
                    Number(r.grand_total_jpy) || fallbackJpy || Number(r.total_jpy) || 0;
                  // CNY 合计 = JPY*汇率 + 关税CNY (汇率 = 1 JPY 对应的 CNY)
                  const rate = Number(r.intl_exchange_rate) || 0;
                  const tariffCny =
                    Number(r.tariff_cny) ||
                    (rate > 0 ? (Number(r.tariff_jpy) || 0) * rate : 0);
                  const fallbackCny =
                    rate > 0 ? totalJpy * rate + tariffCny : 0;
                  const totalCny =
                    Number(r.grand_total_cny) || fallbackCny || 0;
                  const title = getDisplayTitle(r, items);
                  const simple = simplifyStatus(r.status);
                  return (
                    <TableRow
                      key={r.id}
                      data-state={selected.has(r.id) ? "selected" : undefined}
                      className="group cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => {
                        void import("@/components/japan-parcel/parcel-card-dialog");
                        setOpenTab("overview");
                        setOpenCardId(r.id);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                          aria-label="选中此行"
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <ItemsHoverPreview
                          items={items.map((it) => ({
                            id: it.id,
                            item_title: it.item_title,
                            item_title_cn: it.item_title_cn,
                            item_image_url: it.item_image_url,
                          }))}
                          onClick={() => {
                            void import("@/components/japan-parcel/parcel-card-dialog");
                            setOpenTab("overview");
                            setOpenCardId(r.id);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="line-clamp-1 text-sm font-medium">{title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.source_order_no || "—"} ·{" "}
                          {PARCEL_SOURCE_LABEL[r.source as keyof typeof PARCEL_SOURCE_LABEL] ?? r.source}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {subCount > 0 ? (
                          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums">
                            {subCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {totalCny > 0 || totalJpy > 0 ? (
                          <div className="space-y-0.5">
                            {totalJpy > 0 && (
                              <div className="font-mono text-sm font-semibold tabular-nums">
                                ¥{totalJpy.toLocaleString()}
                              </div>
                            )}
                            {totalCny > 0 && (
                              <div className="font-mono text-sm font-semibold tabular-nums">
                                ￥{Math.round(totalCny).toLocaleString()}
                              </div>
                            )}
                            {tariffCny > 0 && (
                              <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                税 ￥{Math.round(tariffCny).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {r.purchased_at ? new Date(r.purchased_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        {simple === "delivered" ? (
                          <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20 border-0">
                            <CheckCircle2 className="h-3 w-3" /> 已签收
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Package className="h-3 w-3" /> 已采购
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          {simple === "delivered" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ id: r.id, status: "purchased" })}
                              title="撤销签收"
                            >
                              撤销签收
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-[11px] font-medium text-success hover:bg-success/10 hover:text-success"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ id: r.id, status: "delivered" })}
                              title="确认签收"
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              确认签收
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="编辑"
                            title="编辑"
                            onClick={() => {
                              void import("@/components/japan-parcel/parcel-card-dialog");
                              setOpenTab("edit");
                              setOpenCardId(r.id);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            disabled={delMut.isPending}
                            onClick={() => {
                              if (confirm("确认删除此订单？")) delMut.mutate(r.id);
                            }}
                            aria-label="删除"
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {openCardId && (
        <Suspense fallback={null}>
          <ParcelCardDialog
            open={!!openCardId}
            onOpenChange={(o) => !o && setOpenCardId(null)}
            parcel={openParcel}
            items={(openParcel?.japan_parcel_items ?? []) as ParcelCardItem[]}
            defaultTab={openTab}
          />
        </Suspense>
      )}
    </div>
  );
}
