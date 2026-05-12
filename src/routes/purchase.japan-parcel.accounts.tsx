import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, KeyRound, Plus, RefreshCw, Trash2, Zap, History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  createMerukiAccount,
  deleteMerukiAccount,
  listMerukiAccounts,
  listSyncRuns,
  syncMerukiOrders,
  testMerukiLogin,
} from "@/lib/meruki.functions";

export const Route = createFileRoute("/purchase/japan-parcel/accounts")({
  head: () => ({ meta: [{ title: "Meruki 账号管理 · BOOMER OFF" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listMerukiAccounts);
  const create = useServerFn(createMerukiAccount);
  const del = useServerFn(deleteMerukiAccount);
  const test = useServerFn(testMerukiLogin);
  const sync = useServerFn(syncMerukiOrders);
  const fetchRuns = useServerFn(listSyncRuns);

  const accounts = useQuery({ queryKey: ["meruki-accounts"], queryFn: () => fetchAccounts() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", cookie: "", display_name: "" });
  const [runsFor, setRunsFor] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: (r) => {
      toast.success(r.warning ? `账号已添加（${r.warning}）` : "账号添加成功");
      setOpen(false);
      setForm({ username: "", password: "", cookie: "", display_name: "" });
      qc.invalidateQueries({ queryKey: ["meruki-accounts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("账号已删除");
      qc.invalidateQueries({ queryKey: ["meruki-accounts"] });
    },
  });

  const testMut = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (r) => {
      r.ok ? toast.success("登录成功") : toast.error(`登录失败：${r.reason}`);
      qc.invalidateQueries({ queryKey: ["meruki-accounts"] });
    },
  });

  const syncMut = useMutation({
    mutationFn: (id: string) => sync({ data: { id } }),
    onSuccess: (r) => {
      r.ok ? toast.success(`同步完成：${r.fetched}/${r.inserted}/${r.updated}`) : toast.error(r.reason);
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
  });

  const runs = useQuery({
    queryKey: ["meruki-runs", runsFor],
    queryFn: () => fetchRuns({ data: { account_id: runsFor! } }),
    enabled: !!runsFor,
  });

  const rows = accounts.data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Meruki 账号管理"
        description="添加 meruki 登录账号，用于抓取「进行中订单」"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/purchase/japan-parcel">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> 返回列表
              </Link>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-brand hover:opacity-90">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> 新增账号
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>新增 Meruki 账号</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>备注名（可选）</Label>
                    <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="主账号" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>用户名 *</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>密码</Label>
                    <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    <p className="text-xs text-muted-foreground">系统会自动尝试登录并缓存 Cookie。如站点要求验证码，请改用下方 Cookie。</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Cookie（兜底，可选）</Label>
                    <Textarea rows={3} value={form.cookie} onChange={(e) => setForm({ ...form, cookie: e.target.value })} placeholder="在浏览器登录 meruki 后复制 document.cookie 粘贴" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                  <Button onClick={() => createMut.mutate()} disabled={!form.username || (!form.password && !form.cookie) || createMut.isPending}>
                    {createMut.isPending ? "添加中…" : "添加并测试登录"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {accounts.isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>
          ) : rows.length === 0 ? (
            <EmptyState title="还没有账号" description="添加 meruki 账号后即可同步订单" icon={KeyRound} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账号</TableHead>
                  <TableHead>登录状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id as string}>
                    <TableCell>
                      <div className="font-medium">{(a.display_name as string) || (a.username as string)}</div>
                      <div className="text-xs text-muted-foreground">{maskUser(a.username as string)}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
                        a.last_login_status === "ok" ? "bg-emerald-50 text-emerald-700" :
                        a.last_login_status === "captcha" ? "bg-amber-50 text-amber-700" :
                        a.last_login_status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      }`}>
                        {a.last_login_status === "ok" ? "✓ 正常" :
                         a.last_login_status === "captcha" ? "需验证码" :
                         a.last_login_status === "failed" ? "失败" : "未登录"}
                      </span>
                      {a.last_error ? <div className="mt-1 text-xs text-muted-foreground">{a.last_error as string}</div> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.last_login_at ? new Date(a.last_login_at as string).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => testMut.mutate(a.id as string)} disabled={testMut.isPending}>
                        <Zap className="mr-1 h-3.5 w-3.5" /> 测试
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => syncMut.mutate(a.id as string)} disabled={syncMut.isPending}>
                        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} /> 同步
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRunsFor(a.id as string)}>
                        <History className="mr-1 h-3.5 w-3.5" /> 日志
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm("删除此账号？")) delMut.mutate(a.id as string); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!runsFor} onOpenChange={(v) => !v && setRunsFor(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          <SheetHeader><SheetTitle>同步日志</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2">
            {runs.data?.rows.length ? runs.data.rows.map((r) => (
              <div key={r.id} className="rounded border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${r.status === "success" ? "text-emerald-600" : r.status === "failed" ? "text-destructive" : ""}`}>
                    {r.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  抓取 {r.fetched_count} · 新增 {r.inserted_count} · 更新 {r.updated_count}
                </div>
                {r.message && <div className="mt-1 text-xs text-destructive">{r.message}</div>}
              </div>
            )) : <p className="text-sm text-muted-foreground">暂无日志</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function maskUser(u: string) {
  if (!u) return "";
  if (u.includes("@")) {
    const [n, d] = u.split("@");
    return `${n.slice(0, 2)}***@${d}`;
  }
  return u.length > 4 ? `${u.slice(0, 2)}***${u.slice(-2)}` : u;
}
