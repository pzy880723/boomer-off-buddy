import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ImageOff } from "lucide-react";
import { simplifyStatus, SIMPLE_STATUS_LABEL } from "@/lib/japan-parcel.helpers";
import { getJapanParcel } from "@/lib/japan-parcel.functions";
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
  purchased_at?: string | null;
  received_at?: string | null;
  grand_total_jpy?: number | null;
  grand_total_cny?: number | null;
  intl_total_jpy?: number | null;
  intl_total_cny?: number | null;
  intl_freight_jpy?: number | null;
  intl_reinforce_jpy?: number | null;
  intl_merge_fee_jpy?: number | null;
  intl_send_fee_jpy?: number | null;
  intl_exchange_rate?: number | null;
  tariff_jpy?: number | null;
}

export function ParcelCardDialog({
  open,
  onOpenChange,
  parcel,
  defaultTab = "overview",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parcel: ParcelCardData | null;
  /** 不再使用，列表行字段不全；保留兼容 */
  items?: ParcelCardItem[];
  defaultTab?: "overview" | "edit";
}) {
  const [tab, setTab] = useState<string>(defaultTab);
  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  const get = useServerFn(getJapanParcel);
  const id = parcel?.id;
  const q = useQuery({
    queryKey: ["jp-parcel", id],
    queryFn: () => get({ data: { id: id! } }),
    enabled: !!id && open,
  });

  if (!parcel) return null;

  const fullRow = (q.data?.row ?? parcel) as unknown as ParcelFormValue;
  const fullItems = (q.data?.items ?? []) as ParcelCardItem[];
  const itemsTotalJpy = fullItems.reduce(
    (s, it) => s + (Number(it.item_total_jpy) || 0),
    0,
  );
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
            {q.isFetching && (
              <span className="text-[10px] text-muted-foreground">加载中…</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="edit">编辑</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-3">
            {q.isLoading && !q.data ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                加载中…
              </div>
            ) : (
              <ParcelOverviewSections
                value={fullRow}
                itemsTotalJpy={itemsTotalJpy}
                itemsSlot={<OverviewItems items={fullItems} />}
              />
            )}
          </TabsContent>

          <TabsContent value="edit" className="pt-3">
            <ParcelEditPanel
              parcelId={parcel.id}
              compact
              onDeleted={() => onOpenChange(false)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function OverviewItems({ items }: { items: ParcelCardItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        此包裹暂无子订单
      </div>
    );
  }
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {items.map((it, idx) => (
        <div key={it.id} className="flex gap-3 rounded-md border p-2">
          {it.item_image_url ? (
            <img
              src={it.item_image_url}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              <ImageOff className="h-5 w-5" />
            </div>
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
            <div className="mt-1 grid grid-cols-3 gap-1 text-[11px]">
              <div>
                <div className="text-muted-foreground">单价</div>
                <div className="font-mono">
                  {it.unit_price_jpy != null
                    ? `¥${Number(it.unit_price_jpy).toLocaleString()}`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">数量</div>
                <div className="font-mono">{it.quantity ?? "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">重量</div>
                <div className="font-mono">
                  {it.weight_g != null ? `${it.weight_g}g` : "—"}
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between gap-1 border-t pt-1">
              <span className="text-muted-foreground">小计</span>
              <span className="font-mono">
                {it.item_total_jpy != null
                  ? `¥${Number(it.item_total_jpy).toLocaleString()}`
                  : "—"}
                {it.item_total_cny != null
                  ? ` ≈ ￥${Number(it.item_total_cny).toLocaleString()}`
                  : ""}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
