// 集中管理的模拟数据，便于后续替换为真实 API
export const kpis = {
  todayRevenue: 12840,
  todayRevenueDelta: 8.4,
  monthRevenue: 386520,
  monthRevenueDelta: 12.6,
  inventoryValue: 1240800,
  inventoryValueDelta: -2.1,
  totalOrders: 1842,
  totalOrdersDelta: 5.3,
};

export const channelShare = [
  { name: "日本大宗", value: 42, fill: "var(--color-chart-1)" },
  { name: "日本小包裹", value: 18, fill: "var(--color-chart-2)" },
  { name: "闲鱼", value: 16, fill: "var(--color-chart-3)" },
  { name: "抖音", value: 12, fill: "var(--color-chart-4)" },
  { name: "小红书/拼多多", value: 12, fill: "var(--color-chart-5)" },
];

export const logisticsTrend = [
  { month: "5月", freight: 18200, tax: 4200 },
  { month: "6月", freight: 21500, tax: 5100 },
  { month: "7月", freight: 19800, tax: 4800 },
  { month: "8月", freight: 24300, tax: 5600 },
  { month: "9月", freight: 22100, tax: 5200 },
  { month: "10月", freight: 26800, tax: 6100 },
];

export const storeRanking = [
  { name: "上海·安福路店", value: 86420 },
  { name: "成都·太古里店", value: 72150 },
  { name: "北京·三里屯店", value: 68900 },
  { name: "杭州·天目里店", value: 54300 },
  { name: "广州·东山口店", value: 48200 },
  { name: "深圳·万象天地店", value: 42100 },
  { name: "武汉·光谷店", value: 38600 },
  { name: "长沙·IFS 店", value: 32100 },
  { name: "南京·新街口店", value: 28400 },
  { name: "苏州·诚品店", value: 24800 },
];

export type Batch = {
  id: string;
  name: string;
  totalCost: number;
  expectedRevenue: number;
  currentRevenue: number;
  itemCount: number;
};

export const batches: Batch[] = [
  { id: "B-2025-018", name: "10月日本九州杂货批", totalCost: 86200, expectedRevenue: 240000, currentRevenue: 168400, itemCount: 312 },
  { id: "B-2025-017", name: "10月大阪古着精选", totalCost: 124000, expectedRevenue: 320000, currentRevenue: 348000, itemCount: 186 },
  { id: "B-2025-016", name: "9月东京拍卖集货", totalCost: 68400, expectedRevenue: 180000, currentRevenue: 92400, itemCount: 264 },
  { id: "B-2025-015", name: "9月名古屋家居杂货", totalCost: 42000, expectedRevenue: 120000, currentRevenue: 38600, itemCount: 198 },
];

export const japanBulk = [
  { id: "JP-B-1024", trackingNo: "EH123456789JP", orderCount: 24, jpyAmount: 1820000, rate: 0.048, freight: 6800, tax: 1240, status: "已入库" },
  { id: "JP-B-1023", trackingNo: "EH987654321JP", orderCount: 18, jpyAmount: 1240000, rate: 0.049, freight: 5400, tax: 980, status: "运输中" },
  { id: "JP-B-1022", trackingNo: "EH555888777JP", orderCount: 31, jpyAmount: 2640000, rate: 0.048, freight: 9200, tax: 1820, status: "清关中" },
  { id: "JP-B-1021", trackingNo: "EH111222333JP", orderCount: 12, jpyAmount: 680000, rate: 0.047, freight: 3200, tax: 540, status: "已入库" },
];

export const japanParcel = [
  { id: "JP-S-2048", emsNo: "EM123JP", item: "Showa 复古玻璃杯 ×4", jpy: 8400, status: "派送中" },
  { id: "JP-S-2047", emsNo: "EM456JP", item: "中古 SONY 收音机", jpy: 12800, status: "已入库" },
  { id: "JP-S-2046", emsNo: "EM789JP", item: "古布制束口袋 ×6", jpy: 5200, status: "清关中" },
  { id: "JP-S-2045", emsNo: "EM321JP", item: "昭和漆器礼盒", jpy: 18600, status: "运输中" },
];

export const domesticOrders = {
  闲鱼: [
    { id: "XY-3201", title: "80年代搪瓷杯怀旧", price: 38, status: "已发货" },
    { id: "XY-3200", title: "老式胶片相机一台", price: 280, status: "待发货" },
  ],
  抖音: [
    { id: "DY-5512", title: "复古铁皮玩具盲盒", price: 128, status: "已收货" },
    { id: "DY-5511", title: "中古真皮单肩包", price: 320, status: "已发货" },
  ],
  小红书: [
    { id: "XHS-2201", title: "vintage 玻璃花瓶", price: 88, status: "已收货" },
  ],
  拼多多: [
    { id: "PDD-9901", title: "怀旧国货搪瓷盘 ×3", price: 45, status: "已发货" },
  ],
};

export type Product = {
  id: string;
  sku: string;
  rfidEpc: string | null;
  name: string;
  category: string;
  batchId: string;
  estimatedCost: number;
  retailPrice: number;
  status: "在库" | "已调拨" | "已售出";
};

export const products: Product[] = [
  { id: "P-10248", sku: "BO-VG-0248", rfidEpc: null, name: "昭和复古玻璃糖果罐", category: "玻璃器", batchId: "B-2025-018", estimatedCost: 42, retailPrice: 168, status: "在库" },
  { id: "P-10247", sku: "BO-CR-0247", rfidEpc: "E280-1100-0000-0247", name: "中古陶瓷茶壶", category: "陶瓷", batchId: "B-2025-018", estimatedCost: 68, retailPrice: 248, status: "已调拨" },
  { id: "P-10246", sku: "BO-TX-0246", rfidEpc: null, name: "古布束口袋（蓝染）", category: "布艺", batchId: "B-2025-017", estimatedCost: 28, retailPrice: 98, status: "已售出" },
  { id: "P-10245", sku: "BO-MT-0245", rfidEpc: null, name: "铁皮发条玩具·大象", category: "玩具", batchId: "B-2025-017", estimatedCost: 86, retailPrice: 320, status: "在库" },
  { id: "P-10244", sku: "BO-EL-0244", rfidEpc: "E280-1100-0000-0244", name: "SONY 中古收音机", category: "电子", batchId: "B-2025-016", estimatedCost: 240, retailPrice: 880, status: "在库" },
  { id: "P-10243", sku: "BO-VG-0243", rfidEpc: null, name: "切子玻璃清酒杯 ×2", category: "玻璃器", batchId: "B-2025-016", estimatedCost: 56, retailPrice: 198, status: "已售出" },
];

export const transfers = [
  { id: "TR-0421", from: "总仓·上海", to: "上海·安福路店", items: 24, status: "已签收", date: "2026-05-08" },
  { id: "TR-0420", from: "总仓·上海", to: "成都·太古里店", items: 36, status: "运输中", date: "2026-05-09" },
  { id: "TR-0419", from: "总仓·上海", to: "北京·三里屯店", items: 18, status: "待发货", date: "2026-05-10" },
];

export const stores = [
  { id: "S-001", type: "直营" as const, name: "上海·安福路店", franchisee: "—", youzanId: "yz_88001", address: "上海市徐汇区安福路 322 号", status: "营业中" },
  { id: "S-002", type: "直营" as const, name: "北京·三里屯店", franchisee: "—", youzanId: "yz_88002", address: "北京市朝阳区三里屯路 19 号", status: "营业中" },
  { id: "S-003", type: "加盟" as const, name: "成都·太古里店", franchisee: "李雪", youzanId: "yz_88003", address: "成都市锦江区中纱帽街", status: "营业中" },
  { id: "S-004", type: "加盟" as const, name: "杭州·天目里店", franchisee: "王浩", youzanId: "yz_88004", address: "杭州市西湖区天目里", status: "装修中" },
  { id: "S-005", type: "加盟" as const, name: "广州·东山口店", franchisee: "陈敏", youzanId: "yz_88005", address: "广州市越秀区东山口", status: "营业中" },
];

export const franchisees = [
  { id: "F-01", name: "李雪", contractEnd: "2027-08-31", stores: 1, materialProgress: 100, decorationProgress: 100 },
  { id: "F-02", name: "王浩", contractEnd: "2028-03-15", stores: 1, materialProgress: 80, decorationProgress: 65 },
  { id: "F-03", name: "陈敏", contractEnd: "2027-11-20", stores: 1, materialProgress: 100, decorationProgress: 100 },
  { id: "F-04", name: "赵琳", contractEnd: "2028-06-30", stores: 0, materialProgress: 30, decorationProgress: 10 },
];

export const knowledgeArticles = [
  { id: "K-001", type: "商品知识", title: "昭和玻璃器鉴别要点", updated: "2026-04-22" },
  { id: "K-002", type: "SOP", title: "门店日常开店流程 SOP v2.1", updated: "2026-05-01" },
  { id: "K-003", type: "QA", title: "顾客常见问题应答手册", updated: "2026-04-18" },
  { id: "K-004", type: "装修流程", title: "新店装修标准流程与节点", updated: "2026-03-30" },
  { id: "K-005", type: "商品知识", title: "中古布艺品保养指南", updated: "2026-04-10" },
  { id: "K-006", type: "SOP", title: "RFID 盘点标准操作流程", updated: "2026-04-26" },
];
