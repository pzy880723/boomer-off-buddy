import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/stores/youzan")({
  head: () => ({ meta: [{ title: "有赞对接 · 门店加盟" }, { name: "description", content: "有赞连锁门店 API 同步状态" }] }),
  component: YouzanPage,
});

const logs = [
  { time: "2026-05-10 09:32", action: "拉取销售订单", result: "成功 · 拉取 18 条" },
  { time: "2026-05-10 08:00", action: "同步商品库存", result: "成功 · 更新 246 个 SKU" },
  { time: "2026-05-09 22:15", action: "拉取销售订单", result: "成功 · 拉取 32 条" },
  { time: "2026-05-09 20:00", action: "同步商品上架", result: "成功 · 新增 12 个商品" },
];

function YouzanPage() {
  return (
    <div>
      <PageHeader title="有赞对接" description="有赞连锁门店 API 同步状态与日志" />
      <div className="grid gap-4 lg:grid-cols-2 mb-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              连接状态
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">连接状态</span>
              <Badge className="bg-success text-success-foreground">已连接</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">关联门店</span>
              <span>5 家</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">同步商品总数</span>
              <span>1,284</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">最近同步</span>
              <span className="text-muted-foreground">2026-05-10 09:32</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">手动同步</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" onClick={() => toast.success("已触发商品同步任务")}>
              <RefreshCw className="h-4 w-4 mr-2" />
              同步商品至有赞
            </Button>
            <Button className="w-full" variant="outline" onClick={() => toast.success("已触发订单拉取任务")}>
              <RefreshCw className="h-4 w-4 mr-2" />
              拉取有赞订单
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">同步日志</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {logs.map((l, i) => (
              <li key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <span className="font-medium">{l.action}</span>
                  <span className="text-xs text-muted-foreground ml-2">{l.time}</span>
                </div>
                <span className="text-success text-xs">{l.result}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
