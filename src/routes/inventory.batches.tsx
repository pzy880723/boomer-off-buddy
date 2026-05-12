import { createFileRoute } from "@tanstack/react-router";
import { Plus, TrendingUp, Calendar, Package, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { batches } from "@/lib/mock-data";

export const Route = createFileRoute("/inventory/batches")({
  head: () => ({ meta: [{ title: "采购批次 · 库存" }, { name: "description", content: "批次价值与回本率分析" }] }),
  component: BatchesPage,
});

function BatchesPage() {
  return (
    <div>
      <PageHeader
        title="采购批次"
        description="实时计算每个批次的回本率与盈利状态"
        actions={
          <Button size="sm" className="bg-gradient-brand hover:opacity-90" onClick={() => toast.info("功能开发中")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新建批次
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {batches.map((b) => {
          const rate = (b.currentRevenue / b.totalCost) * 100;
          const profitable = rate >= 100;
          const expectedRate = (b.expectedRevenue / b.totalCost) * 100;
          return (
            <Card key={b.id} className="overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="flex">
                <img src={b.cover} alt={b.name} className="h-32 w-32 shrink-0 object-cover" />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold">{b.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{b.id}</p>
                    </div>
                    {profitable ? (
                      <Badge className="bg-success/10 text-success hover:bg-success/15">
                        <TrendingUp className="mr-1 h-3 w-3" />
                        已盈利
                      </Badge>
                    ) : (
                      <Badge variant="secondary">回本中</Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    预计回本 · {b.expectedBreakeven}
                    <span className="text-border">·</span>
                    <Package className="h-3 w-3" />
                    {b.itemCount} 件
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground">总成本</p>
                    <p className="mt-0.5 font-semibold tabular-nums">¥{b.totalCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">预期营收</p>
                    <p className="mt-0.5 font-semibold tabular-nums">¥{b.expectedRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">预期回报</p>
                    <p className="mt-0.5 font-semibold tabular-nums text-success">{expectedRate.toFixed(0)}%</p>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="text-muted-foreground">回本率</span>
                    <span className={`tabular-nums font-semibold ${profitable ? "text-success" : "text-foreground"}`}>
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Math.min(rate, 100)} className={`h-2 ${profitable ? "[&>*]:bg-success" : "[&>*]:bg-gradient-brand"}`} />
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>已收 ¥{b.currentRevenue.toLocaleString()}</span>
                    <span>剩 ¥{Math.max(b.totalCost - b.currentRevenue, 0).toLocaleString()}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                  查看批次内 SKU 列表
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
