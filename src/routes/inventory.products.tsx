import { createFileRoute } from "@tanstack/react-router";
import { Search, Upload, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { products } from "@/lib/mock-data";

export const Route = createFileRoute("/inventory/products")({
  head: () => ({ meta: [{ title: "商品档案 · 库存" }, { name: "description", content: "管理商品档案、SKU 与 RFID EPC" }] }),
  component: ProductsPage,
});

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  在库: "default",
  已调拨: "secondary",
  已售出: "outline",
};

function ProductsPage() {
  return (
    <div>
      <PageHeader
        title="商品档案"
        description={`共 ${products.length} 件商品 · RFID EPC 字段已预留`}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("功能开发中")}>
              <Upload className="h-4 w-4 mr-2" />
              批量导入
            </Button>
            <Button onClick={() => toast.info("功能开发中")}>
              <Plus className="h-4 w-4 mr-2" />
              新增商品
            </Button>
          </>
        }
      />
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="按 SKU 或名称搜索..." className="pl-8" />
      </div>
      <DataTable
        rowKey={(r) => r.id}
        data={products}
        columns={[
          { header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
          {
            header: "RFID EPC",
            cell: (r) =>
              r.rfidEpc ? (
                <span className="font-mono text-xs text-success">{r.rfidEpc}</span>
              ) : (
                <span className="text-xs text-muted-foreground">未绑定</span>
              ),
          },
          { header: "商品名称", cell: (r) => r.name },
          { header: "分类", cell: (r) => <Badge variant="outline">{r.category}</Badge> },
          { header: "批次", cell: (r) => <span className="font-mono text-xs">{r.batchId}</span> },
          { header: "估算成本", cell: (r) => `¥${r.estimatedCost}`, className: "text-right" },
          { header: "零售价", cell: (r) => <span className="font-medium">¥{r.retailPrice}</span>, className: "text-right" },
          { header: "状态", cell: (r) => <Badge variant={statusVariant[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
