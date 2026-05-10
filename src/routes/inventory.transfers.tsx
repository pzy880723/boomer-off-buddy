import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { transfers } from "@/lib/mock-data";

export const Route = createFileRoute("/inventory/transfers")({
  head: () => ({ meta: [{ title: "库存调拨 · 库存" }, { name: "description", content: "总仓与门店之间的库存调拨" }] }),
  component: () => (
    <div>
      <PageHeader
        title="库存调拨"
        description="管理总仓与门店之间的货物调拨"
        actions={
          <Button onClick={() => toast.info("功能开发中")}>
            <Plus className="h-4 w-4 mr-2" />
            新建调拨单
          </Button>
        }
      />
      <DataTable
        rowKey={(r) => r.id}
        data={transfers}
        columns={[
          { header: "调拨单号", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { header: "源仓库", cell: (r) => r.from },
          { header: "目标门店", cell: (r) => r.to },
          { header: "商品数", cell: (r) => `${r.items} 件`, className: "text-right" },
          { header: "状态", cell: (r) => <Badge variant="secondary">{r.status}</Badge> },
          { header: "日期", cell: (r) => <span className="text-muted-foreground">{r.date}</span> },
        ]}
      />
    </div>
  ),
});
