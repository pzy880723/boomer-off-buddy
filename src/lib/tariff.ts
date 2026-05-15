// 行邮税三档 + 类目字典（前后端共用）

export type TariffTierRate = 0.13 | 0.2 | 0.5;

export interface TariffTier {
  rate: TariffTierRate;
  label: string; // e.g. "13% 食品/书籍/玩具"
}

export const TARIFF_TIERS: TariffTier[] = [
  { rate: 0.13, label: "13% 食品/药品/书/玩具/小家电" },
  { rate: 0.2, label: "20% 服装/鞋包/相机/数码" },
  { rate: 0.5, label: "50% 化妆品/香水/烟酒/高档手表" },
];

export interface TariffCategory {
  key: string;
  label: string;
  rate: TariffTierRate;
}

export const TARIFF_CATEGORIES: TariffCategory[] = [
  // 13%
  { key: "snack", label: "零食/食品", rate: 0.13 },
  { key: "supplement", label: "保健品", rate: 0.13 },
  { key: "medicine", label: "药品", rate: 0.13 },
  { key: "book", label: "书籍", rate: 0.13 },
  { key: "media", label: "CD/DVD/蓝光", rate: 0.13 },
  { key: "toy_figure", label: "玩具/手办/模型", rate: 0.13 },
  { key: "small_appliance", label: "普通小家电", rate: 0.13 },
  { key: "game_console", label: "游戏机/卡带", rate: 0.13 },
  { key: "computer", label: "电脑及配件", rate: 0.13 },
  // 20%
  { key: "clothing", label: "服装", rate: 0.2 },
  { key: "shoes", label: "鞋", rate: 0.2 },
  { key: "bag", label: "包/箱包", rate: 0.2 },
  { key: "watch_normal", label: "普通手表", rate: 0.2 },
  { key: "beauty_device", label: "美容仪", rate: 0.2 },
  { key: "camera", label: "数码相机/摄影", rate: 0.2 },
  { key: "headphone", label: "耳机/音频", rate: 0.2 },
  { key: "sports", label: "运动用品", rate: 0.2 },
  { key: "stationery", label: "文具", rate: 0.2 },
  // 50%
  { key: "cosmetics", label: "化妆品/护肤品", rate: 0.5 },
  { key: "perfume", label: "香水", rate: 0.5 },
  { key: "tobacco_alcohol", label: "烟酒", rate: 0.5 },
  { key: "watch_luxury", label: "高档手表(≥1万)", rate: 0.5 },
  // 兜底
  { key: "other", label: "其他", rate: 0.2 },
];

export function getTariffCategory(key: string | null | undefined): TariffCategory | null {
  if (!key) return null;
  return TARIFF_CATEGORIES.find((c) => c.key === key) ?? null;
}

export function tariffCategoryLabel(key: string | null | undefined): string {
  return getTariffCategory(key)?.label ?? "未识别";
}

export function rateToPercent(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${Math.round(Number(r) * 100)}%`;
}
