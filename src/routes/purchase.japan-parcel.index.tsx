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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
import { CurrencyToggle } from "@/components/japan-parcel/currency-toggle";
import { ViewModeToggle } from "@/components/japan-parcel/view-mode-toggle";
import { useCurrencyDisplay } from "@/hooks/use-currency-display";
import { useParcelViewMode } from "@/hooks/use-parcel-view-mode";
import { cn } from "@/lib/utils";

const ParcelCardDialog = lazy(() =>
  import("@/components/japan-parcel/parcel-card-dialog").then((m) => ({
    default: m.ParcelCardDialog,
  })),
);

type SortField = "intl_pay_at" | "grand_total_cny" | "created_at";
type SortDir = "asc" | "desc";
type SortState = { field: SortField; dir: SortDir };

const buildListKey = (search: string, sort: SortState) =>
  ["jp-parcels", { search, sort }] as const;

const listOptions = (search: string, sort: SortState) => ({
  queryKey: buildListKey(search, sort),
  queryFn: () => listJapanParcels({ data: { search, sort } }),
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
  weight_g?: number | null;
  unit_price_jpy?: number | null;
  quantity?: number | null;
  sub_order_no?: string | null;
  position?: number | null;
  tariff_category?: string | null;
  tariff_rate?: number | null;
};

type ParcelRow = ParcelCardData & {
  source: string;
  item_title: string | null;
  item_title_cn: string | null;
  item_image_url: string | null;
  total_jpy: number | null;
  tariff_cny?: number | null;
  intl_pay_at?: string | null;
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
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<"overview" | "edit">("overview");
  const [currency] = useCurrencyDisplay();
  const [viewMode] = useParcelViewMode();
  const [sort, setSort] = useState<SortState>({ field: "intl_pay_at", dir: "desc" });
  const debouncedSearch = useDebounced(search, 300);

  const list = useQuery({
    ...listOptions(debouncedSearch, sort),
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

  const toggleSort = (field: SortField) =>
    setSort((s) =>
      s.field === field ? { field, dir: s.dir === "desc" ? "asc" : "desc" } : { field, dir: "desc" },
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

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">展示</span>
              <ViewModeToggle />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">币种</span>
              <CurrencyToggle />
            </div>
          </div>
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
                  {viewMode === "parcel" && (
                    <TableHead className="w-[36px] text-center">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="全选" />
                    </TableHead>
                  )}
                  <TableHead className="w-[64px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">图</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {viewMode === "parcel" ? "订单 / 标题" : "商品 / 所属包裹"}
                  </TableHead>
                  {viewMode === "parcel" ? (
                    <TableHead className="w-[60px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">子单</TableHead>
                  ) : (
                    <TableHead className="w-[80px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">数量</TableHead>
                  )}
                  <TableHead className="text-center">
                    <SortHeader
                      label="合计"
                      active={sort.field === "grand_total_cny"}
                      dir={sort.dir}
                      onClick={() => toggleSort("grand_total_cny")}
                    />
                  </TableHead>
                  <TableHead className="text-center">
                    <SortHeader
                      label="支付时间"
                      title="国际物流支付时间"
                      active={sort.field === "intl_pay_at"}
                      dir={sort.dir}
                      onClick={() => toggleSort("intl_pay_at")}
                    />
                  </TableHead>
                  <TableHead className="w-[110px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">状态</TableHead>
                  <TableHead className="w-[160px] text-center text-[11px] uppercase tracking-wider text-muted-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.flatMap((r) => {
                  const items = (r.japan_parcel_items ?? []) as ItemRow[];
                  const subCount = items.length;
                  const subSumJpy = items.reduce((s, it) => s + (Number(it.item_total_jpy) || 0), 0);
                  const fallbackJpy = subSumJpy + (Number(r.intl_total_jpy) || 0);
                  const totalJpy =
                    Number(r.grand_total_jpy) || fallbackJpy || Number(r.total_jpy) || 0;
                  const rate = Number(r.intl_exchange_rate) || 0;
                  const tariffCny =
                    Number(r.tariff_cny) ||
                    (rate > 0 ? (Number(r.tariff_jpy) || 0) * rate : 0);
                  const fallbackCny = rate > 0 ? totalJpy * rate + tariffCny : 0;
                  const totalCny = Number(r.grand_total_cny) || fallbackCny || 0;
                  const title = getDisplayTitle(r, items);
                  const simple = simplifyStatus(r.status);
                  const payAt = r.intl_pay_at ?? r.purchased_at ?? null;
                  const payAtDisplay = payAt
                    ? new Date(payAt).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";
                  const openCard = (tab: "overview" | "edit" = "overview") => {
                    void import("@/components/japan-parcel/parcel-card-dialog");
                    setOpenTab(tab);
                    setOpenCardId(r.id);
                  };

                  if (viewMode === "item") {
                    const sortedItems = [...items].sort(
                      (a, b) => (Number(a.position) || 0) - (Number(b.position) || 0),
                    );
                    const displayItems: (ItemRow | null)[] = sortedItems.length ? sortedItems : [null];
                    return displayItems.map((it, idx) => {
                      const itJpy = it ? Number(it.item_total_jpy) || 0 : 0;
                      const itCny = it
                        ? Number(it.item_total_cny) || (rate > 0 ? itJpy * rate : 0)
                        : 0;
                      return (
                        <TableRow
                          key={`${r.id}-${it?.id ?? "empty"}-${idx}`}
                          className="group cursor-pointer transition-colors hover:bg-muted/40"
                          onClick={() => openCard("overview")}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {it?.item_image_url ? (
                              <img
                                src={it.item_image_url}
                                alt=""
                                className="h-12 w-12 rounded object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded bg-muted" />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="line-clamp-1 text-sm font-medium">
                              {it?.item_title_cn || it?.item_title || title}
                            </div>
                            {it?.item_title_cn && it?.item_title && (
                              <div className="line-clamp-1 text-[11px] text-muted-foreground">
                                {it.item_title}
                              </div>
                            )}
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>包裹 {r.source_order_no || r.id.slice(0, 8)}</span>
                              {it?.tariff_category && (
                                <span className="rounded bg-muted px-1 py-px text-[10px]">
                                  {it.tariff_category}
                                  {it.tariff_rate ? ` ${(Number(it.tariff_rate) * 100).toFixed(0)}%` : ""}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm tabular-nums">
                            {it?.quantity ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {itJpy > 0 || itCny > 0 ? (
                              <div className="space-y-0.5">
                                {currency !== "cny" && itJpy > 0 && (
                                  <div className="font-mono text-sm font-semibold tabular-nums">
                                    ¥{itJpy.toLocaleString()}
                                  </div>
                                )}
                                {currency !== "jpy" && itCny > 0 && (
                                  <div className="font-mono text-sm font-semibold tabular-nums">
                                    ￥{Math.round(itCny).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                            {payAtDisplay}
                          </TableCell>
                          <TableCell className="text-center">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-[11px]"
                              onClick={() => openCard("overview")}
                            >
                              打开包裹
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  }

                  return [
                    <TableRow
                      key={r.id}
                      data-state={selected.has(r.id) ? "selected" : undefined}
                      className="group cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => openCard("overview")}
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
                          onClick={() => openCard("overview")}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="line-clamp-1 text-sm font-medium">{title}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.source_order_no || "—"}
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
                            {currency !== "cny" && totalJpy > 0 && (
                              <div className="font-mono text-sm font-semibold tabular-nums">
                                ¥{totalJpy.toLocaleString()}
                              </div>
                            )}
                            {currency !== "jpy" && totalCny > 0 && (
                              <div className="font-mono text-sm font-semibold tabular-nums">
                                ￥{Math.round(totalCny).toLocaleString()}
                              </div>
                            )}
                            {currency !== "jpy" && tariffCny > 0 && (
                              <div className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                税 ￥{Math.round(tariffCny).toLocaleString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                        {payAtDisplay}
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
                            onClick={() => openCard("edit")}
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
                    </TableRow>,
                  ];
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

function SortHeader({
  label,
  title,
  active,
  dir,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] uppercase tracking-wider transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <Icon className={cn("h-3 w-3", !active && "opacity-40")} />
    </button>
  );
}

