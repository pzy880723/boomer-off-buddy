import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { simplifyStatus, SIMPLE_STATUS_LABEL } from "@/lib/japan-parcel.helpers";
import { ParcelEditPanel } from "./parcel-edit-panel";

export interface ParcelCardItem {
  id: string;
  item_title: string | null;
  item_title_cn: string | null;
  item_image_url: string | null;
  item_total_jpy: number | null;
  item_total_cny: number | null;
  unit_price_jpy?: number | null;
  quantity?: number | null;
  weight_g?: number | null;
  sub_order_no?: string | null;
}

export interface ParcelCardData {
  id: string;
  source_order_no: string | null;
  tracking_no: string | null;
  status: string;
  purchased_at: string | null;
  intl_total_jpy: number | null;
  intl_freight_jpy: number | null;
  intl_reinforce_jpy: number | null;
  intl_merge_fee_jpy: number | null;
  intl_send_fee_jpy: number | null;
  intl_exchange_rate: number | null;
  tariff_jpy: number | null;
  grand_total_jpy: number | null;
  grand_total_cny: number | null;
}

export function ParcelCardDialog({
  open,
  onOpenChange,
  parcel,
  items,
  defaultTab = "overview",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parcel: ParcelCardData | null;
  items: ParcelCardItem[];
  defaultTab?: "overview" | "edit";
}) {
  const [tab, setTab] = useState<string>(defaultTab);
  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  if (!parcel) return null;
  const itemsTotalJpy = items.reduce((s, it) => s + (Number(it.item_total_jpy) || 0), 0);
  const grandJpy = parcel.grand_total_jpy ?? itemsTotalJpy + (Number(parcel.intl_total_jpy) || 0);
  const simple = simplifyStatus(parcel.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span>包裹 {parcel.source_order_no || "(无单号)"}</span>
            <Badge variant={simple === "delivered" ? "default" : "secondary"}>
              {SIMPLE_STATUS_LABEL[simple]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="edit">编辑</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/30 p-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-muted-foreground">物流单号</div>
                <div className="mt-0.5 font-mono">{parcel.tracking_no || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">采购时间</div>
                <div className="mt-0.5">
                  {parcel.purchased_at ? new Date(parcel.purchased_at).toLocaleDateString() : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">商品数</div>
                <div className="mt-0.5">{items.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">合计</div>
                <div className="mt-0.5 font-mono font-semibold">
                  ¥{grandJpy.toLocaleString()}
                  {parcel.grand_total_cny ? (
                    <span className="ml-1 text-muted-foreground">
                      ≈￥{Number(parcel.grand_total_cny).toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">包裹内商品 ({items.length})</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((it, idx) => (
                  <div key={it.id} className="flex gap-3 rounded-md border p-3">
                    {it.item_image_url ? (
                      <img
                        src={it.item_image_url}
                        alt=""
                        className="h-20 w-20 flex-shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 flex-shrink-0 rounded bg-muted" />
                    )}
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-mono text-[10px] text-muted-foreground">
                        #{idx + 1} · {it.sub_order_no || "—"}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-sm font-medium">
                        {it.item_title_cn || it.item_title || "(未命名)"}
                      </div>
                      {it.item_title_cn && it.item_title && (
                        <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                          {it.item_title}
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="text-muted-foreground">
                          {it.unit_price_jpy != null ? `¥${Number(it.unit_price_jpy).toLocaleString()}` : "—"}
                          {it.quantity ? ` × ${it.quantity}` : ""}
                        </span>
                        <span className="font-mono">
                          {it.item_total_jpy != null ? `¥${Number(it.item_total_jpy).toLocaleString()}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                    此包裹暂无子订单
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border p-3 text-xs">
              <h4 className="mb-2 font-semibold">费用明细</h4>
              <dl className="grid grid-cols-2 gap-y-1 sm:grid-cols-4">
                <Row label="商品总额" jpy={itemsTotalJpy} />
                <Row label="国际物流" jpy={parcel.intl_total_jpy} />
                <Row label="加固" jpy={parcel.intl_reinforce_jpy} />
                <Row label="合单" jpy={parcel.intl_merge_fee_jpy} />
                <Row label="发送" jpy={parcel.intl_send_fee_jpy} />
                <Row label="关税" jpy={parcel.tariff_jpy} />
                <div>
                  <dt className="text-muted-foreground">汇率</dt>
                  <dd className="font-mono">{parcel.intl_exchange_rate ?? "—"}</dd>
                </div>
              </dl>
            </div>
          </TabsContent>

          <TabsContent value="edit" className="pt-3">
            {/* 与详情页字段一致 */}
            <ParcelEditPanel parcelId={parcel.id} compact onDeleted={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, jpy }: { label: string; jpy: number | null | undefined }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">{jpy != null ? `¥${Number(jpy).toLocaleString()}` : "—"}</dd>
    </div>
  );
}
