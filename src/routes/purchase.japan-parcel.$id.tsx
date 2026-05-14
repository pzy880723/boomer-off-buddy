import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ParcelStatusBadge } from "@/components/parcel-status-badge";
import { CompletenessRing } from "@/components/completeness-ring";
import { ParcelForm, type ParcelFormValue } from "@/components/parcel-form";
import {
  deleteJapanParcel,
  getJapanParcel,
  updateJapanParcel,
  updateJapanParcelStatus,
} from "@/lib/japan-parcel.functions";
import { PARCEL_SOURCE_LABEL, PARCEL_STATUS_OPTIONS } from "@/lib/japan-parcel.helpers";

export const Route = createFileRoute("/purchase/japan-parcel/$id")({
  head: () => ({ meta: [{ title: "小包裹详情 · BOOMER OFF" }] }),
  component: ParcelDetail,
});

function ParcelDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getJapanParcel);
  const update = useServerFn(updateJapanParcel);
  const del = useServerFn(deleteJapanParcel);
  const setStatus = useServerFn(updateJapanParcelStatus);

  const q = useQuery({
    queryKey: ["jp-parcel", id],
    queryFn: () => get({ data: { id } }),
  });

  const [form, setForm] = useState<ParcelFormValue>({});
  useEffect(() => {
    if (q.data?.row) {
      const r = q.data.row;
      const f: ParcelFormValue = {};
      Object.entries(r).forEach(([k, v]) => {
        if (k !== "raw_payload" && k !== "completeness" && k !== "created_at" && k !== "updated_at" && k !== "account_id") {
          f[k] = v as string | number | null;
        }
      });
      setForm(f);
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () => update({ data: { id, ...form } as never }),
    onSuccess: () => {
      toast.success("已保存");
      qc.invalidateQueries({ queryKey: ["jp-parcel", id] });
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => {
      toast.success("已删除");
      nav({ to: "/purchase/japan-parcel" });
    },
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => setStatus({ data: { id, status } }),
    onSuccess: () => {
      toast.success("状态已更新");
      qc.invalidateQueries({ queryKey: ["jp-parcel", id] });
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (q.isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>;
  const row = q.data?.row;
  if (!row) return <div className="p-10 text-center">未找到</div>;

  return (
    <div>
      <PageHeader
        title={row.item_title || row.item_title_cn || row.source_order_no || "小包裹"}
        description={`${PARCEL_SOURCE_LABEL[row.source as keyof typeof PARCEL_SOURCE_LABEL] ?? row.source} · ${row.source_order_no ?? "无单号"}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/purchase/japan-parcel"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> 返回列表</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => { if (confirm("删除此订单？")) delMut.mutate(); }}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> 删除
            </Button>
            <Button size="sm" className="bg-gradient-brand hover:opacity-90" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> {saveMut.isPending ? "保存中…" : "保存"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              {row.item_image_url ? (
                <img src={row.item_image_url} alt="" className="aspect-square w-full rounded-md object-cover" />
              ) : (
                <div className="aspect-square w-full rounded-md bg-muted" />
              )}
              <div className="mt-3 flex items-center justify-between">
                <ParcelStatusBadge status={row.status} />
                <CompletenessRing value={row.completeness ?? 0} size={42} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-muted-foreground">总价 JPY</dt>
                <dd className="text-right font-mono">{row.total_jpy != null ? `¥${Number(row.total_jpy).toLocaleString()}` : "—"}</dd>
                <dt className="text-muted-foreground">总价 CNY</dt>
                <dd className="text-right font-mono">{row.total_cny != null ? `￥${Number(row.total_cny).toLocaleString()}` : "—"}</dd>
                <dt className="text-muted-foreground">物流单号</dt>
                <dd className="text-right">{row.tracking_no || "—"}</dd>
                <dt className="text-muted-foreground">创建时间</dt>
                <dd className="text-right">{new Date(row.created_at).toLocaleDateString()}</dd>
              </dl>
            </CardContent>
          </Card>

          {row.raw_payload && (
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">原始数据</h3>
                <pre className="max-h-64 overflow-auto rounded bg-muted/50 p-2 text-[10px]">
                  {JSON.stringify(row.raw_payload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <ParcelForm initial={form} onChange={setForm} />
      </div>
    </div>
  );
}
