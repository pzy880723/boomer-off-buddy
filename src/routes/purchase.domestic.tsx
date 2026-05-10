import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { domesticOrders } from "@/lib/mock-data";

export const Route = createFileRoute("/purchase/domestic")({
  head: () => ({ meta: [{ title: "国内渠道 · 采购物流" }, { name: "description", content: "国内电商平台采购订单聚合" }] }),
  component: DomesticPage,
});

function DomesticPage() {
  const platforms = Object.keys(domesticOrders) as (keyof typeof domesticOrders)[];
  return (
    <div>
      <PageHeader
        title="国内渠道"
        description="自动抓取闲鱼、抖音、小红书、拼多多平台已购商品"
        actions={
          <Button onClick={() => toast.success("已触发同步任务（模拟）")}>
            <RefreshCw className="h-4 w-4 mr-2" />
            手动同步
          </Button>
        }
      />
      <Tabs defaultValue={platforms[0]}>
        <TabsList>
          {platforms.map((p) => (
            <TabsTrigger key={p} value={p}>
              {p}
            </TabsTrigger>
          ))}
        </TabsList>
        {platforms.map((p) => (
          <TabsContent key={p} value={p} className="mt-4">
            <DataTable
              rowKey={(r) => r.id}
              data={domesticOrders[p]}
              columns={[
                { header: "订单号", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
                { header: "商品标题", cell: (r) => r.title },
                { header: "实付金额", cell: (r) => `¥${r.price}`, className: "text-right" },
                { header: "状态", cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
              ]}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
