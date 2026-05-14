// Client-safe helpers and types for the Japan parcel module.

export type ParcelStatus =
  | "purchased"
  | "at_jp_warehouse"
  | "shipping_intl"
  | "delivered"
  | "completed";

export const PARCEL_STATUS_OPTIONS: { value: ParcelStatus; label: string }[] = [
  { value: "purchased", label: "已采购" },
  { value: "at_jp_warehouse", label: "日本仓已入库" },
  { value: "shipping_intl", label: "国际运输中" },
  { value: "delivered", label: "已签收" },
  { value: "completed", label: "已完成" },
];

export const PARCEL_STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(PARCEL_STATUS_OPTIONS.map((s) => [s.value, s.label])),
  // Legacy aliases for rows created before the simplified dictionary.
  paid: "已采购",
  bidding: "竞拍中",
  warehouse_jp: "日本仓已入库",
  customs: "国际运输中",
  shipping_cn: "国际运输中",
};

export type ParcelSource =
  | "meruki"
  | "yahoo"
  | "mercari"
  | "rakuten"
  | "manual"
  | "ai_ocr";

export const PARCEL_SOURCE_LABEL: Record<ParcelSource, string> = {
  meruki: "Meruki",
  yahoo: "Yahoo 拍卖",
  mercari: "Mercari",
  rakuten: "Rakuten",
  manual: "手动录入",
  ai_ocr: "AI 识图",
};

export interface ParcelInput {
  source?: ParcelSource | string;
  source_order_no?: string | null;
  tracking_no?: string | null;
  item_title?: string | null;
  item_title_cn?: string | null;
  item_image_url?: string | null;
  seller?: string | null;
  category?: string | null;
  price_jpy?: number | null;
  service_fee_jpy?: number | null;
  domestic_freight_jpy?: number | null;
  intl_freight_jpy?: number | null;
  total_jpy?: number | null;
  total_cny?: number | null;
  exchange_rate?: number | null;
  status?: ParcelStatus | string;
  purchased_at?: string | null;
  eta?: string | null;
  received_at?: string | null;
  warehouse_location?: string | null;
  weight_g?: number | null;
  notes?: string | null;
}

const COMPLETENESS_FIELDS: (keyof ParcelInput)[] = [
  "source_order_no",
  "tracking_no",
  "item_title",
  "item_image_url",
  "seller",
  "price_jpy",
  "total_jpy",
  "purchased_at",
  "warehouse_location",
  "weight_g",
];

export function computeCompleteness(p: ParcelInput): number {
  const filled = COMPLETENESS_FIELDS.filter((k) => {
    const v = p[k];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}
