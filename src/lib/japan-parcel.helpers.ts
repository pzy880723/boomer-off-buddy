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

// ===== 关税与合计计算 =====

export interface TariffItemLike {
  item_total_jpy?: number | null;
  tariff_rate?: number | null;
  freight_diff_jpy?: number | null;
}

export function computeItemTariffJpy(it: TariffItemLike): number {
  const total = Number(it.item_total_jpy) || 0;
  const rate = Number(it.tariff_rate) || 0;
  return Math.round(total * rate);
}

export function sumTariffJpy(items: TariffItemLike[]): number {
  return items.reduce((s, it) => s + computeItemTariffJpy(it), 0);
}

export function sumFreightDiffJpy(items: TariffItemLike[]): number {
  return items.reduce((s, it) => s + (Number(it.freight_diff_jpy) || 0), 0);
}

/**
 * 合计口径：
 *  - 日本侧（JPY）: 商品 + 国际物流（关税不在日本支付，不进 JPY 合计）
 *  - 国内合计（CNY）= JPY 合计 / 汇率 + 关税 CNY（关税单独换算成人民币加进来）
 */
export function computeGrandTotal(opts: {
  itemsTotalJpy: number;
  intlTotalJpy: number;
  tariffJpy: number;
  exchangeRate?: number | null;
}): { jpy: number; cny: number | null; tariffCny: number | null } {
  const jpy = (opts.itemsTotalJpy || 0) + (opts.intlTotalJpy || 0);
  const r = Number(opts.exchangeRate) || 0;
  // 约定：intl_exchange_rate = 1 JPY 对应的 CNY，故 CNY = JPY * rate
  const tariffCny =
    r > 0 ? Math.round(((opts.tariffJpy || 0) * r) * 100) / 100 : null;
  const cny =
    r > 0
      ? Math.round((jpy * r + (tariffCny ?? 0)) * 100) / 100
      : null;
  return { jpy, cny, tariffCny };
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

// ===== 商品维度到手价（CNY）：商品 + 按重量分摊运费 + 关税 =====

export interface ItemLandedInput {
  id?: string;
  item_total_jpy?: number | null;
  unit_price_jpy?: number | null;
  quantity?: number | null;
  weight_g?: number | null;
  tariff_rate?: number | null;
}

export interface ParcelLandedInput {
  intl_total_jpy?: number | null;
  intl_exchange_rate?: number | null;
}

export interface ItemLanded {
  itemJpy: number;
  freightShareJpy: number;
  itemCny: number | null;
  freightShareCny: number | null;
  tariffCny: number | null;
  landedCny: number | null;
  rate: number;
}

function itemAmountJpy(it: ItemLandedInput): number {
  const total = Number(it.item_total_jpy) || 0;
  if (total > 0) return total;
  const u = Number(it.unit_price_jpy) || 0;
  const q = Number(it.quantity) || 0;
  return u * q;
}

function itemWeightWeight(it: ItemLandedInput): number {
  const w = Number(it.weight_g) || 0;
  if (w > 0) return w;
  // 兜底：用 quantity 做权重，保证非零
  const q = Number(it.quantity) || 1;
  return q;
}

/**
 * 计算整个包裹下每个商品的到手价（CNY）。
 * 返回 Map<itemId | index, ItemLanded>。
 */
export function computeParcelItemLanded(
  parcel: ParcelLandedInput,
  items: ItemLandedInput[],
): Map<string, ItemLanded> {
  const map = new Map<string, ItemLanded>();
  const rate = Number(parcel.intl_exchange_rate) || 0;
  const intl = Number(parcel.intl_total_jpy) || 0;

  // 按重量分摊：若所有 weight_g 都缺失则按 quantity 兜底（已在 itemWeightWeight 里处理）
  const weights = items.map(itemWeightWeight);
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  items.forEach((it, idx) => {
    const itemJpy = itemAmountJpy(it);
    const freightShareJpy =
      totalWeight > 0 ? (intl * weights[idx]) / totalWeight : 0;
    const itemCny = rate > 0 ? itemJpy * rate : null;
    const freightShareCny = rate > 0 ? freightShareJpy * rate : null;
    const tariffRate = Number(it.tariff_rate) || 0;
    const tariffCny = rate > 0 ? itemJpy * tariffRate * rate : null;
    const landedCny =
      rate > 0 ? (itemCny || 0) + (freightShareCny || 0) + (tariffCny || 0) : null;
    map.set(it.id ?? String(idx), {
      itemJpy,
      freightShareJpy,
      itemCny,
      freightShareCny,
      tariffCny,
      landedCny,
      rate,
    });
  });

  return map;
}

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
