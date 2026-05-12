import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Search,
  RefreshCw,
  Image as ImageIcon,
  KeyRound,
  Filter,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { ParcelStatusBadge } from "@/components/parcel-status-badge";
import { CompletenessRing } from "@/components/completeness-ring";
import { EmptyState } from "@/components/empty-state";
import {
  PARCEL_SOURCE_LABEL,
  PARCEL_STATUS_OPTIONS,
} from "@/lib/japan-parcel.helpers";
import { listJapanParcels } from "@/lib/japan-parcel.functions";
import { listMerukiAccounts, syncMerukiOrders } from "@/lib/meruki.functions";

export const Route = createFileRoute("/purchase/japan-parcel")({
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
  const fetchAccounts = useServerFn(listMerukiAccounts);
  const sync = useServerFn(syncMerukiOrders);

  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const list = useQuery({
    queryKey: ["jp-parcels", { search, statuses, sources, onlyIncomplete }],
    queryFn: () =>
      fetchList({
        data: {
          search,
          status: statuses.length ? statuses : undefined,
          source: sources.length ? sources : undefined,
          onlyIncomplete,
        },
      }),
  });

  const accounts = useQuery({
    queryKey: ["meruki-accounts"],
    queryFn: () => fetchAccounts(),
  });

  const syncMut = useMutation({
    mutationFn: (id: string) => sync({ data: { id } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(`同步完成：抓取 ${r.fetched}，新增 ${r.inserted}，更新 ${r.updated}`);
        qc.invalidateQueries({ queryKey: ["jp-parcels"] });
      } else {
        toast.error(`同步失败：${r.reason}`);
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = list.data?.rows ?? [];
  const accs = accounts.data?.rows ?? [];

  const toggle = (arr: string[], v: string, setter: (a: string[]) => void) =>
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div>
      <PageHeader
        title="日本小包裹"
        description="抓取 meruki 账号订单 · AI 截图识别 · 手动录入"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/purchase/japan-parcel/accounts">
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                账号管理
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!accs.length || syncMut.isPending}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} />
                  从 meruki 同步
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>选择账号</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accs.length ? (
                  accs.map((a) => (
                    <DropdownMenuItem key={a.id as string} onClick={() => syncMut.mutate(a.id as string)}>
                      {(a.display_name as string) || (a.username as string)}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>请先添加账号</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="outline" size="sm">
              <Link to="/purchase/japan-parcel/new" search={{ tab: "ai" }}>
                <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                AI 识图
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-brand hover:opacity-90">
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
                <DropdownMenuItem key={s.value} onSelect={(e) => { e.preventDefault(); toggle(statuses, s.value, setStatuses); }}>
                  <input type="checkbox" readOnly checked={statuses.includes(s.value)} className="mr-2" />
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
                <DropdownMenuItem key={v} onSelect={(e) => { e.preventDefault(); toggle(sources, v, setSources); }}>
                  <input type="checkbox" readOnly checked={sources.includes(v)} className="mr-2" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <Switch id="incomplete" checked={onlyIncomplete} onCheckedChange={setOnlyIncomplete} />
            <Label htmlFor="incomplete" className="text-xs">仅看待补全</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="暂无小包裹订单"
              description="可以从 meruki 账号同步、AI 识图导入，或手动新建。"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">图</TableHead>
                  <TableHead>订单号 / 标题</TableHead>
                  <TableHead>卖家</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">总价 ¥</TableHead>
                  <TableHead>采购时间</TableHead>
                  <TableHead className="text-center">完整度</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer">
                    <TableCell>
                      {r.item_image_url ? (
                        <img src={r.item_image_url} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Link to="/purchase/japan-parcel/$id" params={{ id: r.id }} className="block">
                        <div className="font-medium text-sm">
                          {r.item_title || r.item_title_cn || r.source_order_no || "(未命名)"}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {r.source_order_no || "—"} · {PARCEL_SOURCE_LABEL[r.source as keyof typeof PARCEL_SOURCE_LABEL] ?? r.source}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{r.seller || "—"}</TableCell>
                    <TableCell><ParcelStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {r.total_jpy != null ? `¥${Number(r.total_jpy).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.purchased_at ? new Date(r.purchased_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center"><CompletenessRing value={r.completeness ?? 0} /></div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
