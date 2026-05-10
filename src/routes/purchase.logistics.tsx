import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/purchase/logistics")({
  head: () => ({ meta: [{ title: "物流追踪 · 采购物流" }, { name: "description", content: "国际与国内物流轨迹实时追踪" }] }),
  component: LogisticsPage,
});

const tracking = [
  { time: "2026-05-09 14:22", node: "已抵达上海浦东国际机场", done: true },
  { time: "2026-05-09 03:18", node: "成田机场起飞", done: true },
  { time: "2026-05-08 18:40", node: "包裹于成田机场仓库交接", done: true },
  { time: "2026-05-08 09:10", node: "东京集货中心打包封装", done: true },
  { time: "2026-05-10 (预计)", node: "上海清关 / 派送", done: false },
];

function LogisticsPage() {
  return (
    <div>
      <PageHeader title="物流追踪" description="国际与国内物流轨迹实时查询" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-4 w-4" />
              EH123456789JP · 日本大宗包裹
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l-2 border-border ml-2 space-y-4">
              {tracking.map((t, i) => (
                <li key={i} className="ml-4">
                  <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center">
                    {t.done ? (
                      <CheckCircle2 className="h-4 w-4 text-success bg-card" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground bg-card" />
                    )}
                  </span>
                  <p className={`text-sm ${t.done ? "" : "text-muted-foreground"}`}>{t.node}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.time}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">物流接口配置</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• 国际物流：日本邮政 EMS / DHL 接口（待配置）</p>
            <p>• 国内物流：快递100 通用查询接口（待配置）</p>
            <p className="pt-2">配置真实 API Key 后将自动更新所有包裹轨迹。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
