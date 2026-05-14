import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  Image as ImageIcon,
  Filter,
  Upload,
  ChevronDown,
  Trash2,
  Pencil,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { ParcelStatusBadge } from "@/components/parcel-status-badge";
import { CompletenessRing } from "@/components/completeness-ring";
import { EmptyState } from "@/components/empty-state";
import {
  PARCEL_SOURCE_LABEL,
  PARCEL_STATUS_OPTIONS,
} from "@/lib/japan-parcel.helpers";
import {
  listJapanParcels,
  updateJapanParcelStatus,
  deleteJapanParcel,
  bulkDeleteJapanParcels,
} from "@/lib/japan-parcel.functions";
import { useDebounced } from "@/hooks/use-debounced";

export const Route = createFileRoute("/purchase/japan-parcel/")({
  head: () => ({
    meta: [
      { title: "日本小包裹 · BOOMER OFF" },
      { name: "description", content: "Meruki / Yahoo / Mercari 小包裹订单管理" },
    ],
  }),
  component: JapanParcelList,
});

function JapanParcelList() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listJapanParcels);
  const updateStatus = useServerFn(updateJapanParcelStatus);
  const delOne = useServerFn(deleteJapanParcel);
  const delMany = useServerFn(bulkDeleteJapanParcels);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const debouncedSearch = useDebounced(search, 300);

  const queryKey = ["jp-parcels", { search: debouncedSearch, statuses, sources, onlyIncomplete }] as const;

  const list = useQuery({
    queryKey,
    queryFn: () =>
      fetchList({
        data: {
          search: debouncedSearch,
          status: statuses.length ? statuses : undefined,
          source: sources.length ? sources : undefined,
          onlyIncomplete,
        },
      }),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  type ListData = Awaited<ReturnType<typeof fetchList>>;

  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      updateStatus({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["jp-parcels"] });
      const snapshots = qc.getQueriesData<ListData>({ queryKey: ["jp-parcels"] });
      snapshots.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData<ListData>(key, {
          ...data,
          rows: data.rows.map((r) =>
            r.id === v.id ? { ...r, status: v.status } : r
          ),
        });
      });
      return { snapshots };
    },
    onError: (e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error((e as Error).message);
    },
    onSuccess: () => {
      toast.success("状态已更新");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
  });

  const rows = list.data?.rows ?? [];

  const toggle = (arr: string[], v: string, setter: (a: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

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
            <Button asChild variant="outline" size="sm">
              <Link to="/purchase/japan-parcel/new" search={{ tab: "ai" }}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                单条 AI 识图
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/purchase/japan-parcel/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                手动新建
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
              placeholder="搜索订单号 / 标题 / 卖家 / 物流单号"
              className="h-9 pl-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                状态 {statuses.length ? `(${statuses.length})` : ""}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {PARCEL_STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem
                  key={s.value}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggle(statuses, s.value, setStatuses);
                  }}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={statuses.includes(s.value)}
                    className="mr-2"
                  />
                  {s.label}
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
                    toggle(sources, v, setSources);
                  }}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={sources.includes(v)}
                    className="mr-2"
                  />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <Switch
              id="incomplete"
              checked={onlyIncomplete}
              onCheckedChange={setOnlyIncomplete}
            />
            <Label htmlFor="incomplete" className="text-xs">
              仅看待补全
            </Label>
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
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="全选"
                    />
                  </TableHead>
                  <TableHead className="w-[60px]">图</TableHead>
                  <TableHead>订单号 / 标题</TableHead>
                  <TableHead>卖家</TableHead>
                  <TableHead className="text-center">子单</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">合计 ￥</TableHead>
                  <TableHead>采购时间</TableHead>
                  <TableHead className="text-center">完整度</TableHead>
                  <TableHead className="w-[100px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const subs = (r as { japan_parcel_items?: { item_total_cny: number | null; item_title: string | null; item_image_url: string | null }[] }).japan_parcel_items ?? [];
                  const subCount = subs.length;
                  const subSumCny = subs.reduce((s, it) => s + (Number(it.item_total_cny) || 0), 0);
                  const totalCny = (Number(r.intl_total_cny) || 0) + subSumCny;
                  const firstTitle = subs[0]?.item_title;
                  const firstImage = subs[0]?.item_image_url;
                  return (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleSelect(r.id)}
                        aria-label="选中此行"
                      />
                    </TableCell>
                    <TableCell>
                      <Link to="/purchase/japan-parcel/$id" params={{ id: r.id }}>
                        {(r.item_image_url || firstImage) ? (
                          <img
                            src={(r.item_image_url || firstImage)!}
                            alt=""
                            className="h-10 w-10 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted" />
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to="/purchase/japan-parcel/$id" params={{ id: r.id }}>
                        <div className="font-medium text-sm">
                          {r.item_title || r.item_title_cn || firstTitle || r.source_order_no || "(未命名)"}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.source_order_no || "—"} ·{" "}
                          {PARCEL_SOURCE_LABEL[
                            r.source as keyof typeof PARCEL_SOURCE_LABEL
                          ] ?? r.source}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.seller || r.receiver_name || "—"}</TableCell>
                    <TableCell className="text-center text-sm">
                      {subCount > 0 ? (
                        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium">
                          {subCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="inline-flex items-center gap-1 rounded hover:opacity-80"
                            disabled={statusMut.isPending}
                          >
                            <ParcelStatusBadge status={r.status} />
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {PARCEL_STATUS_OPTIONS.map((s) => (
                            <DropdownMenuItem
                              key={s.value}
                              onSelect={() =>
                                statusMut.mutate({ id: r.id, status: s.value })
                              }
                            >
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {totalCny > 0
                        ? `￥${totalCny.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : r.total_jpy != null
                        ? `¥${Number(r.total_jpy).toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.purchased_at
                        ? new Date(r.purchased_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <CompletenessRing value={r.completeness ?? 0} />
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
    </div>
  );
}
