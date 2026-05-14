import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  deleteJapanParcel,
  deleteParcelItem,
  getJapanParcel,
  updateJapanParcel,
  updateJapanParcelStatus,
  updateParcelItem,
} from "@/lib/japan-parcel.functions";
import { PARCEL_STATUS_OPTIONS } from "@/lib/japan-parcel.helpers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParcelFormValue } from "@/components/parcel-form";
import { ParcelEditSections } from "./parcel-edit-sections";

type ItemRow = {
  id: string;
  sub_order_no: string | null;
  merchant_order_no: string | null;
  source_platform: string | null;
  condition: string | null;
  addon_service: string | null;
  item_title: string | null;
  item_title_cn: string | null;
  item_image_url: string | null;
  unit_price_jpy: number | null;
  item_price_jpy: number | null;
  quantity: number | null;
  item_total_jpy: number | null;
  item_total_cny: number | null;
  exchange_rate: number | null;
  service_fee_jpy: number | null;
  domestic_freight_jpy: number | null;
  freight_diff_jpy: number | null;
  weight_g: number | null;
  pay_method: string | null;
  pay_at: string | null;
  notes: string | null;
};

const EXCLUDED_KEYS = new Set([
  "raw_payload",
  "completeness",
  "created_at",
  "updated_at",
  "account_id",
  "status_timeline",
]);

export function ParcelEditPanel({
  parcelId,
  onDeleted,
  compact = false,
}: {
  parcelId: string;
  onDeleted?: () => void;
  /** 弹窗内 vs 详情页：当前两者展示一致，参数保留兼容 */
  compact?: boolean;
}) {
  const id = parcelId;
  const nav = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getJapanParcel);
  const update = useServerFn(updateJapanParcel);
  const del = useServerFn(deleteJapanParcel);
  const setStatus = useServerFn(updateJapanParcelStatus);
  const updateItem = useServerFn(updateParcelItem);
  const delItem = useServerFn(deleteParcelItem);

  const [editingItem, setEditingItem] = useState<ItemRow | null>(null);

  const itemSaveMut = useMutation({
    mutationFn: (it: ItemRow) =>
      updateItem({
        data: {
          id: it.id,
          sub_order_no: it.sub_order_no,
          merchant_order_no: it.merchant_order_no,
          source_platform: it.source_platform,
          condition: it.condition,
          addon_service: it.addon_service,
          item_title: it.item_title,
          item_title_cn: it.item_title_cn,
          item_image_url: it.item_image_url,
          unit_price_jpy: it.unit_price_jpy,
          item_price_jpy: it.item_price_jpy,
          quantity: it.quantity,
          item_total_jpy: it.item_total_jpy,
          item_total_cny: it.item_total_cny,
          exchange_rate: it.exchange_rate,
          service_fee_jpy: it.service_fee_jpy,
          domestic_freight_jpy: it.domestic_freight_jpy,
          freight_diff_jpy: it.freight_diff_jpy,
          weight_g: it.weight_g,
          pay_method: it.pay_method,
          pay_at: it.pay_at,
          notes: it.notes,
        },
      }),
    onSuccess: () => {
      toast.success("子订单已更新");
      setEditingItem(null);
      qc.invalidateQueries({ queryKey: ["jp-parcel", id] });
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const itemDelMut = useMutation({
    mutationFn: (itemId: string) => delItem({ data: { id: itemId } }),
    onSuccess: () => {
      toast.success("已删除子订单");
      qc.invalidateQueries({ queryKey: ["jp-parcel", id] });
      qc.invalidateQueries({ queryKey: ["jp-parcels"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const q = useQuery({
    queryKey: ["jp-parcel", id],
    queryFn: () => get({ data: { id } }),
  });

  const [form, setForm] = useState<ParcelFormValue>({});
  useEffect(() => {
    if (q.data?.row) {
      const r = q.data.row as Record<string, unknown>;
      const f: ParcelFormValue = {};
      Object.entries(r).forEach(([k, v]) => {
        if (EXCLUDED_KEYS.has(k)) return;
        if (v === null || typeof v === "string" || typeof v === "number") {
          f[k] = v as string | number | null;
        }
      });
      setForm(f);
    }
  }, [q.data]);

  const items = (q.data?.items ?? []) as ItemRow[];
  const itemsTotalJpy = items.reduce((s, it) => s + (Number(it.item_total_jpy) || 0), 0);
  const timeline =
    (q.data?.row as { status_timeline?: { at?: string | null; text?: string | null }[] } | undefined)
      ?.status_timeline ?? [];

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
      if (onDeleted) onDeleted();
      else nav({ to: "/purchase/japan-parcel" });
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

  if (q.isLoading)
    return <div className="p-10 text-center text-sm text-muted-foreground">加载中…</div>;
  const row = q.data?.row;
  if (!row) return <div className="p-10 text-center">未找到</div>;

  const itemsSlot = (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="py-4 text-center text-xs text-muted-foreground">此包裹暂无子订单</div>
      )}
      {items.map((it, idx) => (
        <div key={it.id} className="flex gap-3 rounded-md border p-3">
          {it.item_image_url ? (
            <img
              src={it.item_image_url}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded object-cover"
            />
          ) : (
            <div className="h-16 w-16 flex-shrink-0 rounded bg-muted" />
          )}
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-muted-foreground">
                #{idx + 1} · {it.sub_order_no || "无单号"}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono">
                  {it.item_total_jpy != null
                    ? `¥${Number(it.item_total_jpy).toLocaleString()}`
                    : "—"}
                  {it.item_total_cny != null
                    ? ` (≈￥${Number(it.item_total_cny).toLocaleString()})`
                    : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setEditingItem(it)}
                >
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive"
                  onClick={() => {
                    if (confirm("删除此子订单？")) itemDelMut.mutate(it.id);
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
            <div className="mt-1 truncate text-sm font-medium">
              {it.item_title_cn || it.item_title || "(未命名)"}
            </div>
            {it.item_title_cn && it.item_title && (
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {it.item_title}
              </div>
            )}
            <div className="mt-0.5 text-muted-foreground">
              单价 {it.unit_price_jpy != null ? `¥${Number(it.unit_price_jpy).toLocaleString()}` : "—"}
              {it.quantity ? ` × ${it.quantity}` : ""} · 入库 {it.weight_g ?? "—"}g
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <span className="mr-2 text-xs text-muted-foreground">快捷修改状态：</span>
          {PARCEL_STATUS_OPTIONS.map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={row.status === s.value ? "default" : "outline"}
              onClick={() => statusMut.mutate(s.value)}
              disabled={statusMut.isPending || row.status === s.value}
            >
              {s.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("删除此订单？")) delMut.mutate();
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5 text-destructive" /> 删除
            </Button>
            <Button
              size="sm"
              className="bg-gradient-brand hover:opacity-90"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" /> {saveMut.isPending ? "保存中…" : "保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ParcelEditSections
        value={form}
        onChange={setForm}
        itemsTotalJpy={itemsTotalJpy}
        itemsSlot={itemsSlot}
      />

      {timeline.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold">状态时间线</h3>
            <ul className="space-y-1.5 text-xs">
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-40 font-mono text-muted-foreground">{t.at ?? "—"}</span>
                  <span>{t.text ?? "—"}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingItem} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑子订单</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <Label className="text-xs">商品标题</Label>
                <Input
                  value={editingItem.item_title ?? ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, item_title: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">中文标题</Label>
                <Input
                  value={editingItem.item_title_cn ?? ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, item_title_cn: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">商品图 URL</Label>
                <Input
                  value={editingItem.item_image_url ?? ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, item_image_url: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">单价 JPY</Label>
                <Input
                  type="number"
                  value={editingItem.unit_price_jpy ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      unit_price_jpy: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">数量</Label>
                <Input
                  type="number"
                  value={editingItem.quantity ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      quantity: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">合计 JPY</Label>
                <Input
                  type="number"
                  value={editingItem.item_total_jpy ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      item_total_jpy: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">合计 CNY</Label>
                <Input
                  type="number"
                  value={editingItem.item_total_cny ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      item_total_cny: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">入库重量 g</Label>
                <Input
                  type="number"
                  value={editingItem.weight_g ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      weight_g: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={itemSaveMut.isPending}
              onClick={() => editingItem && itemSaveMut.mutate(editingItem)}
            >
              {itemSaveMut.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
