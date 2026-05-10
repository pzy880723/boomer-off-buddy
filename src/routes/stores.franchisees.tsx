import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { franchisees } from "@/lib/mock-data";

export const Route = createFileRoute("/stores/franchisees")({
  head: () => ({ meta: [{ title: "加盟商管理 · 门店加盟" }, { name: "description", content: "加盟商档案与开店进度" }] }),
  component: () => (
    <div>
      <PageHeader
        title="加盟商管理"
        description="加盟商档案、合同与开店进度跟踪"
        actions={
          <Button onClick={() => toast.info("功能开发中")}>
            <Plus className="h-4 w-4 mr-2" />
            新增加盟商
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {franchisees.map((f) => (
          <Card key={f.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-primary-foreground">{f.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{f.name}</p>
                  <p className="text-xs text-muted-foreground">合同至 {f.contractEnd} · {f.stores} 家门店</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">物料配送</span>
                  <span>{f.materialProgress}%</span>
                </div>
                <Progress value={f.materialProgress} />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">装修进度</span>
                  <span>{f.decorationProgress}%</span>
                </div>
                <Progress value={f.decorationProgress} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  ),
});
