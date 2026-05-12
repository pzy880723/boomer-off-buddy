import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, KeyRound, Pencil, Plus, RefreshCw, Trash2, Zap, History, Download, Copy } from "lucide-react";
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
  updateMerukiAccount,
} from "@/lib/meruki.functions";

export const Route = createFileRoute("/purchase/japan-parcel/accounts")({
  head: () => ({ meta: [{ title: "Meruki 账号管理 · BOOMER OFF" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listMerukiAccounts);
  const create = useServerFn(createMerukiAccount);
  const update = useServerFn(updateMerukiAccount);
  const del = useServerFn(deleteMerukiAccount);
  const test = useServerFn(testMerukiLogin);
  const sync = useServerFn(syncMerukiOrders);
  const fetchRuns = useServerFn(listSyncRuns);

  const accounts = useQuery({ queryKey: ["meruki-accounts"], queryFn: () => fetchAccounts() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", cookie: "", display_name: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ password: "", cookie: "", display_name: "" });
  const [runsFor, setRunsFor] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: (r: { warning: string | null }) => {
      toast.success(r.warning ? `账号已添加（${r.warning}）` : "账号添加成功");
      setOpen(false);
      setForm({ username: "", password: "", cookie: "", display_name: "" });
      qc.invalidateQueries({ queryKey: ["meruki-accounts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: () => {
      const payload: { id: string; password?: string; cookie?: string; display_name?: string } = { id: editId! };
      if (editForm.password) payload.password = editForm.password;
      if (editForm.cookie) payload.cookie = editForm.cookie;
      if (editForm.display_name) payload.display_name = editForm.display_name;
      return update({ data: payload });
    },
    onSuccess: () => {
      toast.success("账号已更新");
      setEditId(null);
      setEditForm({ password: "", cookie: "", display_name: "" });
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
      r.ok ? toast.success("Cookie 有效，可以同步") : toast.error(r.reason ?? "Cookie 无效");
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
                    <Label>Cookie *</Label>
                    <Textarea rows={3} value={form.cookie} onChange={(e) => setForm({ ...form, cookie: e.target.value })} placeholder="在 meruki 页面控制台执行 copy(document.cookie) 后粘贴" />
                    <p className="text-xs text-muted-foreground">F12 → Console 输入 <code className="rounded bg-muted px-1">copy(document.cookie)</code> 回车，再粘贴到此处。meruki 有滑块验证码，无法自动登录，必须手动粘贴 Cookie。</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
                  <Button onClick={() => createMut.mutate()} disabled={!form.username || !form.cookie || createMut.isPending}>
                    {createMut.isPending ? "添加中…" : "添加账号"}
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
                        a.last_login_status === "cookie_expired" ? "bg-amber-50 text-amber-700" :
                        a.last_login_status === "captcha" ? "bg-amber-50 text-amber-700" :
                        a.last_login_status === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      }`}>
                        {a.last_login_status === "ok" ? "✓ Cookie 有效" :
                         a.last_login_status === "cookie_expired" ? "Cookie 已失效，点编辑更新" :
                         a.last_login_status === "captcha" ? "需验证码" :
                         a.last_login_status === "failed" ? "失败" : "未测试"}
                      </span>
                      {a.last_error ? <div className="mt-1 text-xs text-muted-foreground">{a.last_error as string}</div> : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.last_login_at ? new Date(a.last_login_at as string).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => testMut.mutate(a.id as string)} disabled={testMut.isPending}>
                        <Zap className="mr-1 h-3.5 w-3.5" /> 测试 Cookie
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => syncMut.mutate(a.id as string)} disabled={syncMut.isPending}>
                        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} /> 同步
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditId(a.id as string);
                        setEditForm({ password: "", cookie: "", display_name: (a.display_name as string) ?? "" });
                      }}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> 编辑
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

      <Dialog open={!!editId} onOpenChange={(v) => { if (!v) { setEditId(null); setEditForm({ password: "", cookie: "", display_name: "" }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>编辑 Meruki 账号</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>备注名</Label>
              <Input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>新密码（留空表示不修改）</Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>更新 Cookie（留空表示不修改）</Label>
              <Textarea rows={3} value={editForm.cookie} onChange={(e) => setEditForm({ ...editForm, cookie: e.target.value })} placeholder="在 meruki 页面控制台执行 copy(document.cookie) 后粘贴" />
              <p className="text-xs text-muted-foreground">Cookie 过期后在这里粘贴新 Cookie 即可，无需删除账号。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>取消</Button>
            <Button onClick={() => updateMut.mutate()} disabled={updateMut.isPending || (!editForm.password && !editForm.cookie && !editForm.display_name)}>
              {updateMut.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
