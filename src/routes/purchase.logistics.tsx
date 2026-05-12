import { createFileRoute } from "@tanstack/react-router";
import { Truck, MapPin, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { logisticsTracking } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/purchase/logistics")({
  head: () => ({ meta: [{ title: "物流追踪 · 采购物流" }, { name: "description", content: "国际与国内物流轨迹实时追踪" }] }),
  component: LogisticsPage,
});

function LogisticsPage() {
  return (
    <div>
      <PageHeader
        title="物流追踪"
        description="国际与国内物流轨迹实时查询 · 6 节点全链路可视化"
        meta={<span>当前在途包裹 · 8 票 · 预计 7 日内全部入库</span>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {logisticsTracking.map((pkg) => (
          <Card key={pkg.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-brand text-primary-foreground">
                    <Truck className="h-4 w-4" />
                  </div>
                  {pkg.title}
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {pkg.progress}%
                </Badge>
              </div>
              <p className="mt-1 pl-10 text-xs text-muted-foreground">{pkg.carrier}</p>
            </CardHeader>
            <CardContent>
              <Progress value={pkg.progress} className="mb-5 h-1.5 [&>*]:bg-gradient-brand" />
              <ol className="space-y-3.5">
                {pkg.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="relative flex flex-col items-center">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium",
                          s.done
                            ? "bg-success text-success-foreground"
                            : s.current
                            ? "bg-gradient-brand text-primary-foreground ring-4 ring-primary/15"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      {i < pkg.steps.length - 1 && (
                        <span className={cn("mt-1 h-6 w-px", s.done ? "bg-success" : "bg-border")} />
                      )}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p
                        className={cn(
                          "text-sm",
                          s.done ? "font-medium" : s.current ? "font-medium text-primary" : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{s.date}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              全球物流地图
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              地图组件占位 · 接入高德/Mapbox 后展示
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4 text-primary" />
              物流接口配置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">日本邮政 EMS</p>
                <p className="text-xs text-muted-foreground">国际段轨迹查询</p>
              </div>
              <Badge className="bg-warning/15 text-warning-foreground hover:bg-warning/20">待配置</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">DHL Express</p>
                <p className="text-xs text-muted-foreground">高时效国际段</p>
              </div>
              <Badge className="bg-warning/15 text-warning-foreground hover:bg-warning/20">待配置</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">快递 100</p>
                <p className="text-xs text-muted-foreground">国内段通用查询</p>
              </div>
              <Badge className="bg-success/10 text-success hover:bg-success/15">已连接</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
