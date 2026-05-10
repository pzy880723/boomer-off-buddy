import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { japanParcel } from "@/lib/mock-data";

export const Route = createFileRoute("/purchase/japan-parcel")({
  head: () => ({ meta: [{ title: "日本小包裹 · 采购物流" }, { name: "description", content: "EMS/平台直邮订单追踪" }] }),
  component: () => (
    <div>
      <PageHeader
        title="日本小包裹"
        description="EMS 与平台直邮订单的追踪与入库管理"
        actions={
          <Button onClick={() => toast.info("功能开发中")}>
            <Plus className="h-4 w-4 mr-2" />
            录入订单
          </Button>
        }
      />
      <DataTable
        rowKey={(r) => r.id}
        data={japanParcel}
        columns={[
          { header: "订单编号", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { header: "EMS 单号", cell: (r) => <span className="font-mono text-xs">{r.emsNo}</span> },
          { header: "商品", cell: (r) => r.item },
          { header: "金额(JPY)", cell: (r) => `¥${r.jpy.toLocaleString()}`, className: "text-right" },
          { header: "状态", cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
        ]}
      />
    </div>
  ),
});
