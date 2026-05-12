import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PARCEL_STATUS_OPTIONS } from "@/lib/japan-parcel.helpers";

export type ParcelFormValue = Record<string, string | number | null>;

const SECTIONS: {
  title: string;
  fields: { key: string; label: string; type?: "text" | "number" | "datetime" | "textarea" | "select"; options?: { value: string; label: string }[] }[];
}[] = [
  {
    title: "商品",
    fields: [
      { key: "item_title", label: "商品标题（日）" },
      { key: "item_title_cn", label: "商品标题（中）" },
      { key: "item_image_url", label: "商品图 URL" },
      { key: "seller", label: "卖家 / 店铺" },
      { key: "category", label: "品类" },
    ],
  },
  {
    title: "价格（日元 ¥）",
    fields: [
      { key: "price_jpy", label: "商品价格", type: "number" },
      { key: "service_fee_jpy", label: "服务费", type: "number" },
      { key: "domestic_freight_jpy", label: "日本国内运费", type: "number" },
      { key: "intl_freight_jpy", label: "国际运费", type: "number" },
      { key: "total_jpy", label: "合计 JPY", type: "number" },
      { key: "total_cny", label: "合计 CNY", type: "number" },
      { key: "exchange_rate", label: "汇率", type: "number" },
    ],
  },
  {
    title: "物流",
    fields: [
      { key: "source_order_no", label: "来源订单号" },
      { key: "tracking_no", label: "国际物流单号" },
      { key: "warehouse_location", label: "仓库位置" },
      { key: "weight_g", label: "重量（克）", type: "number" },
      { key: "purchased_at", label: "采购时间", type: "datetime" },
      { key: "eta", label: "预计到达", type: "datetime" },
      { key: "received_at", label: "签收时间", type: "datetime" },
      {
        key: "status",
        label: "状态",
        type: "select",
        options: PARCEL_STATUS_OPTIONS,
      },
    ],
  },
  {
    title: "备注",
    fields: [{ key: "notes", label: "备注", type: "textarea" }],
  },
];

export function ParcelForm({
  initial,
  onChange,
}: {
  initial?: ParcelFormValue;
  onChange: (v: ParcelFormValue) => void;
}) {
  const [v, setV] = useState<ParcelFormValue>(initial ?? { status: "paid", source: "manual" });

  const set = (k: string, val: string | number | null) => {
    const next = { ...v, [k]: val };
    setV(next);
    onChange(next);
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {SECTIONS.map((s) => (
        <Card key={s.title} className="border-border/60">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold">{s.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {s.fields.map((f) => (
              <div key={f.key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    rows={3}
                    value={(v[f.key] as string) ?? ""}
                    onChange={(e) => set(f.key, e.target.value || null)}
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={(v[f.key] as string) ?? ""}
                    onValueChange={(val) => set(f.key, val)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-9"
                    type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                    value={(v[f.key] as string | number) ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (f.type === "number") {
                        set(f.key, raw === "" ? null : Number(raw));
                      } else if (f.type === "datetime") {
                        set(f.key, raw ? new Date(raw).toISOString() : null);
                      } else {
                        set(f.key, raw || null);
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
