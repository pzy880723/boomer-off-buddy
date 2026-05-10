import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <Button onClick={() => toast.info("功能开发中")}>
            <Plus className="h-4 w-4 mr-2" />
            新建批次
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {batches.map((b) => {
          const rate = (b.currentRevenue / b.totalCost) * 100;
          const profitable = rate >= 100;
          return (
            <Card key={b.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{b.id}</p>
                  </div>
                  {profitable ? (
                    <Badge className="bg-success text-success-foreground">已盈利</Badge>
                  ) : (
                    <Badge variant="secondary">回本中</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">总成本</p>
                    <p className="font-semibold">¥{b.totalCost.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">预期营收</p>
                    <p className="font-semibold">¥{b.expectedRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">商品数</p>
                    <p className="font-semibold">{b.itemCount}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">回本率</span>
                    <span className={profitable ? "text-success font-semibold" : "font-semibold"}>
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Math.min(rate, 100)} className={profitable ? "[&>*]:bg-success" : ""} />
                  <p className="text-xs text-muted-foreground mt-1">已收回 ¥{b.currentRevenue.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
