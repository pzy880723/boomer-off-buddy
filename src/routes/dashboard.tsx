import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, DollarSign, Package, Receipt, ShoppingCart } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { batches, channelShare, kpis, logisticsTrend, storeRanking } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "仪表盘 · BOOMER OFF" },
      { name: "description", content: "品牌运营核心指标总览" },
    ],
  }),
  component: DashboardPage,
});

function KpiCard({
  title,
  value,
  delta,
  icon: Icon,
  prefix = "",
}: {
  title: string;
  value: number;
  delta: number;
  icon: typeof DollarSign;
  prefix?: string;
}) {
  const positive = delta >= 0;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold mt-1">
              {prefix}
              {value.toLocaleString("zh-CN")}
            </p>
            <p
              className={`text-xs mt-2 inline-flex items-center gap-1 ${
                positive ? "text-success" : "text-destructive"
              }`}
            >
              {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(delta)}% 较上期
            </p>
          </div>
          <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center text-accent-foreground">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  return (
    <div>
      <PageHeader title="仪表盘" description="实时掌握品牌运营核心指标" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <KpiCard title="今日总营收" value={kpis.todayRevenue} delta={kpis.todayRevenueDelta} icon={DollarSign} prefix="¥" />
        <KpiCard title="本月累计营收" value={kpis.monthRevenue} delta={kpis.monthRevenueDelta} icon={Receipt} prefix="¥" />
        <KpiCard title="在库商品总估值" value={kpis.inventoryValue} delta={kpis.inventoryValueDelta} icon={Package} prefix="¥" />
        <KpiCard title="全渠道订单总量" value={kpis.totalOrders} delta={kpis.totalOrdersDelta} icon={ShoppingCart} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">采购渠道占比</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{}}
              className="h-[280px] w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={channelShare} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                  {channelShare.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">物流成本趋势（近 6 月）</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                freight: { label: "国际运费", color: "var(--color-chart-1)" },
                tax: { label: "关税", color: "var(--color-chart-2)" },
              }}
              className="h-[280px] w-full"
            >
              <LineChart data={logisticsTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="freight" stroke="var(--color-chart-1)" strokeWidth={2} />
                <Line type="monotone" dataKey="tax" stroke="var(--color-chart-2)" strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">批次回本率监控</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {batches.map((b) => {
              const rate = (b.currentRevenue / b.totalCost) * 100;
              const profitable = rate >= 100;
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div>
                      <span className="font-medium">{b.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{b.id}</span>
                    </div>
                    <span className={profitable ? "text-success font-semibold" : "text-foreground"}>
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(rate, 100)}
                    className={profitable ? "[&>*]:bg-success" : ""}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>成本 ¥{b.totalCost.toLocaleString()}</span>
                    <span>已收 ¥{b.currentRevenue.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">门店销售排行 Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ value: { label: "销售额", color: "var(--color-chart-1)" } }}
              className="h-[360px] w-full"
            >
              <BarChart data={storeRanking} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
