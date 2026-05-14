import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  Filter,
  Upload,
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
  bulkSetItemTitlesCn,
} from "@/lib/japan-parcel.functions";
import { translateTitles } from "@/lib/translate.functions";
import { useDebounced } from "@/hooks/use-debounced";
import {
  ParcelCardDialog,
  type ParcelCardData,
  type ParcelCardItem,
} from "@/components/japan-parcel/parcel-card-dialog";
import { ItemsHoverPreview } from "@/components/japan-parcel/items-hover-preview";

const buildListKey = (search: string, sources: string[]) =>
  ["jp-parcels", { search, sources }] as const;

export const Route = createFileRoute("/purchase/japan-parcel/")({
  head: () => ({
    meta: [
      { title: "日本小包裹 · BOOMER OFF" },
      { name: "description", content: "Meruki / Yahoo / Mercari 小包裹订单管理" },
    ],
  }),
  loader: ({ context }) => {
    // 预取空筛选下的列表，让首屏跟着 SSR 一起到位
    context.queryClient.ensureQueryData({
      queryKey: buildListKey("", []),
      queryFn: () => listJapanParcels({ data: {} }),
      staleTime: 60_000,
    });
  },
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
  japan_parcel_items?: ItemRow[];
};

function JapanParcelList() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listJapanParcels);
  const updateStatus = useServerFn(updateJapanParcelStatus);
  const updateParcel = useServerFn(updateJapanParcel);
  const delOne = useServerFn(deleteJapanParcel);
  const delMany = useServerFn(bulkDeleteJapanParcels);
  const fnTranslate = useServerFn(translateTitles);
  const fnSaveTitles = useServerFn(bulkSetItemTitlesCn);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SimpleStatus[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<"overview" | "edit">("overview");
  const debouncedSearch = useDebounced(search, 300);

  const queryKey = buildListKey(debouncedSearch, sources);

  const list = useQuery({
    queryKey,
    queryFn: () =>
      fetchList({
        data: {
          search: debouncedSearch,
          source: sources.length ? sources : undefined,
        },
      }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  type ListData = Awaited<ReturnType<typeof fetchList>>;

  const allRows = (list.data?.rows ?? []) as unknown as ParcelRow[];
  // 客户端按简化状态筛选
  const rows = useMemo(
    () =>
      statusFilter.length
        ? allRows.filter((r) => statusFilter.includes(simplifyStatus(r.status)))
        : allRows,
    [allRows, statusFilter],
  );

  // ===== 懒翻译：列表加载后，自动给前 20 条「第一个子订单缺中文标题」补翻 =====
  const translatedOnce = useRef(false);
  useEffect(() => {
    if (translatedOnce.current || allRows.length === 0) return;
    translatedOnce.current = true;
    const need: { id: string; jp: string }[] = [];
    for (const r of allRows) {
      const items = r.japan_parcel_items ?? [];
      for (const it of items) {
        if (!it.item_title_cn && it.item_title) {
          need.push({ id: it.id, jp: it.item_title });
          if (need.length >= 20) break;
        }
      }
      if (need.length >= 20) break;
    }
    if (need.length === 0) return;
    (async () => {
      try {
        const r = await fnTranslate({ data: { titles: need.map((n) => n.jp) } });
        if (!r.ok) return;
        const updates = need
          .map((n, i) => ({ id: n.id, item_title_cn: r.translations[i] }))
          .filter((u): u is { id: string; item_title_cn: string } => !!u.item_title_cn);
        if (updates.length === 0) return;
        await fnSaveTitles({ data: { updates } });
        // 直接合并到现有缓存，避免再发一次列表请求
        const map = new Map(updates.map((u) => [u.id, u.item_title_cn]));
        qc.setQueriesData<ListData>({ queryKey: ["jp-parcels"] }, (data) => {
          if (!data) return data;
          return {
            ...data,
            rows: data.rows.map((row) => ({
              ...row,
              japan_parcel_items: (row.japan_parcel_items ?? []).map((it) =>
                map.has(it.id) ? { ...it, item_title_cn: map.get(it.id)! } : it,
              ),
            })),
          } as ListData;
        });
      } catch {
        /* silent */
      }
    })();
  }, [allRows, fnTranslate, fnSaveTitles, qc]);

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
        description="截图批量导入 · AI 识图 · 手动录入 · 状态人工维护"
        actions={
          <>
            <Button asChild size="sm" className="bg-gradient-brand hover:opacity-90">
              <Link to="/purchase/japan-parcel/import">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                截图批量导入
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-brand hover:opacity-90">
              <Link to="/purchase/japan-parcel/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                新建包裹
              </Link>
            </Button>
          </>
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
          {list.isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="暂无小包裹订单"
              description="可以截图批量导入、单条 AI 识图，或手动新建。"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36px]">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="全选" />
                  </TableHead>
                  <TableHead className="w-[60px]">图</TableHead>
                  <TableHead>订单 / 标题</TableHead>
                  <TableHead className="text-center">子单</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">合计 ￥</TableHead>
                  <TableHead>采购时间</TableHead>
                  <TableHead className="w-[110px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const items = (r.japan_parcel_items ?? []) as ItemRow[];
                  const subCount = items.length;
                  const subSumJpy = items.reduce((s, it) => s + (Number(it.item_total_jpy) || 0), 0);
                  const totalJpy =
                    Number(r.grand_total_jpy) ||
                    subSumJpy + (Number(r.intl_total_jpy) || 0) + (Number(r.tariff_jpy) || 0) ||
                    Number(r.total_jpy) ||
                    0;
                  const title = getDisplayTitle(r, items);
                  const simple = simplifyStatus(r.status);
                  return (
                    <TableRow
                      key={r.id}
                      data-state={selected.has(r.id) ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => {
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
                          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium">
                            {subCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {simple === "delivered" ? (
                          <Badge className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> 已签收
                          </Badge>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="gap-1">
                              <Package className="h-3 w-3" /> 已采购
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ id: r.id, status: "delivered" })}
                            >
                              确认签收
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {totalJpy > 0 ? `¥${totalJpy.toLocaleString()}` : "—"}
                        {r.grand_total_cny ? (
                          <div className="text-[10px] text-muted-foreground">
                            ≈￥{Number(r.grand_total_cny).toLocaleString()}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.purchased_at ? new Date(r.purchased_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {simple === "delivered" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px]"
                              disabled={statusMut.isPending}
                              onClick={() => statusMut.mutate({ id: r.id, status: "purchased" })}
                            >
                              撤销签收
                            </Button>
                          )}
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                            <Link to="/purchase/japan-parcel/$id" params={{ id: r.id }} aria-label="编辑">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            disabled={delMut.isPending}
                            onClick={() => {
                              if (confirm("确认删除此订单？")) delMut.mutate(r.id);
                            }}
                            aria-label="删除"
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

      <ParcelCardDialog
        open={!!openCardId}
        onOpenChange={(o) => !o && setOpenCardId(null)}
        parcel={openParcel}
        items={(openParcel?.japan_parcel_items ?? []) as ParcelCardItem[]}
      />
    </div>
  );
}
