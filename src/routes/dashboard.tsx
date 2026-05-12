import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DollarSign,
  Package,
  Receipt,
  ShoppingCart,
  Tag,
  Truck,
  AlertTriangle,
  Wallet,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import { Timeline } from "@/components/timeline";
import { StatusBadge } from "@/components/status-badge";
import {
  batches,
  channelShare,
  kpis,
  logisticsTrend,
  recentActivities,
  storeRanking,
  todoItems,
} from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "仪表盘 · BOOMER OFF" },
      { name: "description", content: "品牌运营核心指标总览" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const goalProgress = Math.round((kpis.todayRevenue.value / kpis.todayGoal) * 100);
  const goalData = [{ name: "完成度", value: goalProgress, fill: "var(--color-chart-1)" }];

  return (
    <div>
      <PageHeader
        title="仪表盘"
        description="实时掌握 BOOMER OFF 品牌运营核心指标"
        meta={
          <>
            <span>最近更新 · 1 分钟前</span>
            <span className="text-border">·</span>
            <span>当前周期 · 2026 年 5 月</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              导出报表
            </Button>
            <Button size="sm" className="bg-gradient-brand hover:opacity-90">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI 经营洞察
            </Button>
          </>
        }
      />

      {/* Welcome strip with goal */}
      <Card className="mb-5 overflow-hidden border-none bg-gradient-to-br from-card to-accent/30 shadow-card">
        <CardContent className="flex flex-wrap items-center justify-between gap-6 p-5">
          <div>
            <h2 className="text-lg font-semibold">晚上好，管理员 👋</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              今天是 2026 年 5 月 12 日 · 周二 · 全国 12 家门店在营
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <Badge variant="secondary" className="font-normal">
                日营业目标 ¥{kpis.todayGoal.toLocaleString()}
              </Badge>
              <Badge variant="secondary" className="font-normal">
                已完成 ¥{kpis.todayRevenue.value.toLocaleString()}
              </Badge>
              <Badge className="bg-success/10 text-success hover:bg-success/15">
                超额 {goalProgress - 100}%
              </Badge>
            </div>
          </div>
          <div className="relative h-28 w-28">
            <ChartContainer config={{}} className="h-full w-full">
              <RadialBarChart
                data={goalData}
                startAngle={90}
                endAngle={-270}
                innerRadius="70%"
                outerRadius="100%"
              >
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "var(--color-muted)" }} />
              </RadialBarChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{goalProgress}%</span>
              <span className="text-[10px] text-muted-foreground">目标完成度</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid 2x4 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="今日总营收" value={kpis.todayRevenue.value} prefix="¥" delta={kpis.todayRevenue.delta} icon={DollarSign} spark={kpis.todayRevenue.spark} tone="brand" />
        <MetricCard title="本月累计营收" value={kpis.monthRevenue.value} prefix="¥" delta={kpis.monthRevenue.delta} icon={Receipt} spark={kpis.monthRevenue.spark} />
        <MetricCard title="在库商品总估值" value={kpis.inventoryValue.value} prefix="¥" delta={kpis.inventoryValue.delta} icon={Package} spark={kpis.inventoryValue.spark} />
        <MetricCard title="全渠道订单数" value={kpis.totalOrders.value} delta={kpis.totalOrders.delta} icon={ShoppingCart} spark={kpis.totalOrders.spark} />
        <MetricCard title="本周新增 SKU" value={kpis.newSku.value} delta={kpis.newSku.delta} icon={Tag} spark={kpis.newSku.spark} hint="本周入库" />
        <MetricCard title="待发货订单" value={kpis.pendingShip.value} delta={kpis.pendingShip.delta} icon={Truck} hint="多平台合计" />
        <MetricCard title="低库存预警" value={kpis.lowStockAlerts.value} delta={kpis.lowStockAlerts.delta} icon={AlertTriangle} hint="需补货门店 5 家" />
        <MetricCard title="待结算分账" value={kpis.pendingCommission.value} prefix="¥" delta={kpis.pendingCommission.delta} icon={Wallet} hint="加盟商 4 位" />
      </div>

      {/* Charts row */}
      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">采购渠道占比</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">本月各渠道金额与环比</p>
            </div>
            <Badge variant="outline" className="text-xs">本月</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-2">
                <ChartContainer config={{}} className="h-[180px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={channelShare} dataKey="value" nameKey="name" innerRadius={48} outerRadius={75} paddingAngle={2}>
                      {channelShare.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
              <ul className="col-span-3 space-y-2.5 text-xs">
                {channelShare.map((c) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.fill }} />
                    <span className="flex-1 truncate text-muted-foreground">{c.name}</span>
                    <span className="tabular-nums font-medium">¥{c.amount.toLocaleString()}</span>
                    <span className={`tabular-nums w-12 text-right ${c.delta >= 0 ? "text-success" : "text-destructive"}`}>
                      {c.delta >= 0 ? "+" : ""}{c.delta}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">物流成本与汇率趋势</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">近 6 个月国际运费、关税、JPY 汇率</p>
            </div>
            <Badge variant="outline" className="text-xs">近 6 月</Badge>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                freight: { label: "国际运费", color: "var(--color-chart-1)" },
                tax: { label: "关税", color: "var(--color-chart-2)" },
              }}
              className="h-[240px] w-full"
            >
              <AreaChart data={logisticsTrend}>
                <defs>
                  <linearGradient id="freight-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="tax-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Area type="monotone" dataKey="freight" stroke="var(--color-chart-1)" strokeWidth={2} fill="url(#freight-grad)" />
                <Area type="monotone" dataKey="tax" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#tax-grad)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Batches + Store ranking */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">批次回本率监控</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">追踪每个采购批次的回收进度</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/inventory/batches">
                全部 <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {batches.map((b) => {
              const rate = (b.currentRevenue / b.totalCost) * 100;
              const profitable = rate >= 100;
              return (
                <div key={b.id} className="rounded-lg border p-3 transition-colors hover:bg-accent/30">
                  <div className="flex gap-3">
                    <img src={b.cover} alt={b.name} className="h-12 w-12 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {b.id} · {b.itemCount} 件 · 预计 {b.expectedBreakeven}
                          </p>
                        </div>
                        <span className={`shrink-0 text-base font-semibold tabular-nums ${profitable ? "text-success" : "text-foreground"}`}>
                          {rate.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={Math.min(rate, 100)} className={`mt-2 h-1.5 ${profitable ? "[&>*]:bg-success" : "[&>*]:bg-gradient-brand"}`} />
                      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                        <span>成本 ¥{b.totalCost.toLocaleString()}</span>
                        <span>已收 ¥{b.currentRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div>
              <CardTitle className="text-base">门店销售排行 Top 10</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">本月各门店营收对比</p>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link to="/stores/list">
                全部 <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ value: { label: "销售额", color: "var(--color-chart-1)" } }}
              className="h-[360px] w-full"
            >
              <BarChart data={storeRanking} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} barSize={16}>
                  {storeRanking.map((s, i) => (
                    <Cell key={i} fill={s.type === "直营" ? "var(--color-chart-1)" : "var(--color-chart-2)"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-chart-1" />直营
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-chart-2" />加盟
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity timeline + todos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">实时动态</CardTitle>
            <p className="text-xs text-muted-foreground">系统中的最新业务事件</p>
          </CardHeader>
          <CardContent>
            <Timeline items={recentActivities} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">待办事项</CardTitle>
            <p className="text-xs text-muted-foreground">需要你关注与处理</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {todoItems.map((t) => (
              <Link
                key={t.id}
                to={t.href}
                className="group flex items-center justify-between rounded-md border p-3 transition-all hover:border-primary/30 hover:bg-accent/40"
              >
                <span className="text-sm">{t.label}</span>
                <span className="flex items-center gap-2">
                  <Badge
                    className={`tabular-nums ${
                      t.tone === "destructive"
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                        : t.tone === "warning"
                        ? "bg-warning/15 text-warning-foreground hover:bg-warning/20"
                        : t.tone === "success"
                        ? "bg-success/10 text-success hover:bg-success/15"
                        : t.tone === "info"
                        ? "bg-info/10 text-info hover:bg-info/15"
                        : "bg-accent text-accent-foreground hover:bg-accent/80"
                    }`}
                    variant="secondary"
                  >
                    {t.count}
                  </Badge>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
// silence unused
void LineChart;
void Line;
