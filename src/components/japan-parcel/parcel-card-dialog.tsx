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
import { ParcelOverviewSections } from "./parcel-edit-sections";
import type { ParcelFormValue } from "@/components/parcel-form";

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
  received_at?: string | null;
  intl_total_jpy: number | null;
  intl_total_cny?: number | null;
  intl_freight_jpy: number | null;
  intl_reinforce_jpy: number | null;
  intl_merge_fee_jpy: number | null;
  intl_send_fee_jpy: number | null;
  intl_photo_fee_jpy?: number | null;
  intl_keep_packaging_jpy?: number | null;
  intl_points_used?: number | null;
  intl_ship_method?: string | null;
  intl_charge_method?: string | null;
  intl_pay_method?: string | null;
  intl_pay_at?: string | null;
  intl_merchant_order_no?: string | null;
  intl_exchange_rate: number | null;
  tariff_jpy: number | null;
  grand_total_jpy: number | null;
  grand_total_cny: number | null;
  notes?: string | null;
  warehouse_location?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  receiver_address?: string | null;
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
  const simple = simplifyStatus(parcel.status);

  // 把 parcel 行映射成 ParcelFormValue（只读概览复用编辑布局）
  const overviewValue: ParcelFormValue = parcel as unknown as ParcelFormValue;

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

          <TabsContent value="overview" className="pt-3">
            <ParcelOverviewSections
              value={overviewValue}
              itemsTotalJpy={itemsTotalJpy}
              itemsSlot={<OverviewItems items={items} />}
            />
          </TabsContent>

          <TabsContent value="edit" className="pt-3">
            <ParcelEditPanel parcelId={parcel.id} compact onDeleted={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function OverviewItems({ items }: { items: ParcelCardItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">此包裹暂无子订单</div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={it.id} className="flex gap-3 rounded-md border p-2">
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
                {it.unit_price_jpy != null
                  ? `¥${Number(it.unit_price_jpy).toLocaleString()}`
                  : "—"}
                {it.quantity ? ` × ${it.quantity}` : ""}
              </span>
              <span className="font-mono">
                {it.item_total_jpy != null
                  ? `¥${Number(it.item_total_jpy).toLocaleString()}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
