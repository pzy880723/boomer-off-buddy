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
  source_order_no?: string | null;
  tracking_no?: string | null;
  receiver_name?: string | null;
  receiver_address?: string | null;
  total_weight_g?: number | null;
  intl_total_jpy?: number | null;
  intl_ship_method?: string | null;
  intl_pay_at?: string | null;
  // legacy flat fields kept optional for backward compat
  [key: string]: unknown;
}

const COMPLETENESS_FIELDS: (keyof ParcelInput)[] = [
  "source_order_no",
  "tracking_no",
  "receiver_name",
  "receiver_address",
  "total_weight_g",
  "intl_total_jpy",
  "intl_ship_method",
  "intl_pay_at",
];

export function computeCompleteness(p: ParcelInput): number {
  const filled = COMPLETENESS_FIELDS.filter((k) => {
    const v = p[k];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

export function formatJpy(v: number | null | undefined): string {
  if (v == null) return "—";
  return `¥${Number(v).toLocaleString()}`;
}

export function formatCny(v: number | null | undefined): string {
  if (v == null) return "—";
  return `￥${Number(v).toLocaleString()}`;
}

// ===== UI 简化状态：仅「已采购 / 已签收」两档 =====
export type SimpleStatus = "purchased" | "delivered";

export function simplifyStatus(s: string | null | undefined): SimpleStatus {
  return s === "delivered" || s === "completed" ? "delivered" : "purchased";
}

export const SIMPLE_STATUS_LABEL: Record<SimpleStatus, string> = {
  purchased: "已采购",
  delivered: "已签收",
};

// 包裹列表显示标题：优先取第一个子订单的中文标题
export function getDisplayTitle(
  parcel: { item_title?: string | null; item_title_cn?: string | null; source_order_no?: string | null },
  items: { item_title?: string | null; item_title_cn?: string | null }[],
): string {
  const first = items[0];
  return (
    first?.item_title_cn ||
    first?.item_title ||
    parcel.item_title_cn ||
    parcel.item_title ||
    parcel.source_order_no ||
    "(未命名包裹)"
  );
}
