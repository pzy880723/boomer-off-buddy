import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, RefreshCw, Webhook, Activity, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { youzanSyncLog } from "@/lib/mock-data";

export const Route = createFileRoute("/stores/youzan")({
  head: () => ({ meta: [{ title: "有赞对接 · 门店加盟" }, { name: "description", content: "有赞连锁门店 API 同步状态" }] }),
  component: YouzanPage,
});

const webhooks = [
  { event: "order.status.changed", description: "订单状态变更（用于触发分账）", enabled: true },
  { event: "inventory.low.warning", description: "库存预警（推送至企业微信）", enabled: true },
  { event: "batch.breakeven.achieved", description: "批次达到 100% 回本", enabled: false },
  { event: "store.daily.report", description: "门店每日营业日报", enabled: true },
];

function YouzanPage() {
  return (
    <div>
      <PageHeader
        title="有赞对接"
        description="有赞连锁门店 API 同步状态、Webhook 与日志"
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-success" />
              连接状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">连接状态</p>
                <Badge className="mt-1 bg-success/10 text-success hover:bg-success/15">
                  <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  已连接
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">关联门店</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">5 家</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">同步商品</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">1,284</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">最近同步</p>
                <p className="mt-1 text-sm font-medium tabular-nums">2 分钟前</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              手动同步
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full bg-gradient-brand hover:opacity-90" size="sm" onClick={() => toast.success("已触发商品同步任务")}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              同步商品至有赞
            </Button>
            <Button className="w-full" size="sm" variant="outline" onClick={() => toast.success("已触发订单拉取任务")}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              拉取有赞订单
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" />
              同步日志
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rowKey={(r) => r.id}
              data={youzanSyncLog}
              columns={[
                { header: "时间", cell: (r) => <span className="font-mono text-xs tabular-nums">{r.time}</span> },
                { header: "操作", cell: (r) => <span className="font-medium">{r.action}</span> },
                { header: "处理量", cell: (r) => <span className="tabular-nums">{r.count}</span>, className: "text-right" },
                { header: "结果", cell: (r) => <StatusBadge tone={r.status === "成功" ? "success" : "danger"}>{r.status}</StatusBadge> },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Webhook className="h-4 w-4 text-primary" />
              Webhook 订阅
            </CardTitle>
            <p className="text-xs text-muted-foreground">配置事件触发后向下游系统推送</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {webhooks.map((w) => (
              <div key={w.event} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-medium">{w.event}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{w.description}</p>
                </div>
                <Switch defaultChecked={w.enabled} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
