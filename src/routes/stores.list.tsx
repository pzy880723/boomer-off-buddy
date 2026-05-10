import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { stores } from "@/lib/mock-data";

export const Route = createFileRoute("/stores/list")({
  head: () => ({ meta: [{ title: "门店列表 · 门店加盟" }, { name: "description", content: "管理直营与加盟门店档案" }] }),
  component: () => (
    <div>
      <PageHeader
        title="门店列表"
        description="统一管理直营与加盟门店档案"
        actions={
          <Button onClick={() => toast.info("功能开发中")}>
            <Plus className="h-4 w-4 mr-2" />
            新增门店
          </Button>
        }
      />
      <DataTable
        rowKey={(r) => r.id}
        data={stores}
        columns={[
          {
            header: "类型",
            cell: (r) =>
              r.type === "直营" ? (
                <Badge>{r.type}</Badge>
              ) : (
                <Badge variant="secondary">{r.type}</Badge>
              ),
          },
          { header: "门店名称", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "加盟商", cell: (r) => r.franchisee },
          { header: "有赞门店 ID", cell: (r) => <span className="font-mono text-xs">{r.youzanId}</span> },
          { header: "地址", cell: (r) => <span className="text-muted-foreground">{r.address}</span> },
          {
            header: "状态",
            cell: (r) =>
              r.status === "营业中" ? (
                <Badge className="bg-success text-success-foreground">{r.status}</Badge>
              ) : (
                <Badge variant="outline">{r.status}</Badge>
              ),
          },
        ]}
      />
    </div>
  ),
});
