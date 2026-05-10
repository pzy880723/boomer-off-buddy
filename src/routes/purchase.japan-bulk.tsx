import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { japanBulk } from "@/lib/mock-data";

export const Route = createFileRoute("/purchase/japan-bulk")({
  head: () => ({
    meta: [{ title: "日本大宗 · 采购物流" }, { name: "description", content: "管理日本大宗物流包裹与成本分摊" }],
  }),
  component: JapanBulkPage,
});

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  已入库: "default",
  运输中: "secondary",
  清关中: "outline",
};

function JapanBulkPage() {
  return (
    <div>
      <PageHeader
        title="日本大宗"
        description="跟踪日本拍卖大宗包裹的运输状态与成本分摊"
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("功能开发中")}>
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button onClick={() => toast.info("功能开发中")}>
              <Plus className="h-4 w-4 mr-2" />
              新建大宗包裹
            </Button>
          </>
        }
      />
      <DataTable
        rowKey={(r) => r.id}
        data={japanBulk}
        columns={[
          { header: "包裹编号", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { header: "物流单号", cell: (r) => <span className="font-mono text-xs">{r.trackingNo}</span> },
          { header: "关联订单", cell: (r) => `${r.orderCount} 单` },
          { header: "日元金额", cell: (r) => `¥${r.jpyAmount.toLocaleString()} JPY`, className: "text-right" },
          { header: "汇率", cell: (r) => r.rate.toFixed(3), className: "text-right" },
          { header: "运费(¥)", cell: (r) => r.freight.toLocaleString(), className: "text-right" },
          { header: "关税(¥)", cell: (r) => r.tax.toLocaleString(), className: "text-right" },
          { header: "状态", cell: (r) => <Badge variant={statusVariant[r.status] ?? "default"}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
