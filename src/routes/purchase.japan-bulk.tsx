import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, Filter, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { japanBulk } from "@/lib/mock-data";

export const Route = createFileRoute("/purchase/japan-bulk")({
  head: () => ({
    meta: [{ title: "日本大宗 · 采购物流" }, { name: "description", content: "管理日本大宗物流包裹与成本分摊" }],
  }),
  component: JapanBulkPage,
});

function JapanBulkPage() {
  const totalCNY = japanBulk.reduce((s, b) => s + b.jpyAmount * b.rate, 0);
  const totalFreight = japanBulk.reduce((s, b) => s + b.freight, 0);
  const totalTax = japanBulk.reduce((s, b) => s + b.tax, 0);
  const totalOrders = japanBulk.reduce((s, b) => s + b.orderCount, 0);

  const summary = [
    { label: "本月包裹数", value: japanBulk.length, suffix: " 票" },
    { label: "关联订单总数", value: totalOrders, suffix: " 单" },
    { label: "货值（人民币）", value: `¥${Math.round(totalCNY).toLocaleString()}` },
    { label: "运费 + 关税", value: `¥${(totalFreight + totalTax).toLocaleString()}` },
  ];

  return (
    <div>
      <PageHeader
        title="日本大宗"
        description="跟踪日本拍卖大宗包裹的运输状态、成本分摊与单件均摊"
        meta={<span>支持 EMS / DHL / 空海运 三种方式</span>}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.info("功能开发中")}>
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              筛选
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("功能开发中")}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              导出
            </Button>
            <Button size="sm" className="bg-gradient-brand hover:opacity-90" onClick={() => toast.info("功能开发中")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新建大宗包裹
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {s.value}
                {s.suffix && <span className="ml-0.5 text-sm text-muted-foreground">{s.suffix}</span>}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTable
        rowKey={(r) => r.id}
        data={japanBulk}
        columns={[
          {
            header: "包裹",
            cell: (r) => (
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-xs">{r.id}</div>
                  <div className="text-[11px] text-muted-foreground">{r.trackingNo}</div>
                </div>
              </div>
            ),
          },
          { header: "订单数", cell: (r) => `${r.orderCount} 单`, className: "tabular-nums" },
          { header: "重量", cell: (r) => `${r.weight} kg`, className: "tabular-nums text-right" },
          { header: "日元金额", cell: (r) => `¥${r.jpyAmount.toLocaleString()} JPY`, className: "tabular-nums text-right" },
          { header: "汇率", cell: (r) => r.rate.toFixed(3), className: "tabular-nums text-right" },
          { header: "运费(¥)", cell: (r) => r.freight.toLocaleString(), className: "tabular-nums text-right" },
          { header: "关税(¥)", cell: (r) => r.tax.toLocaleString(), className: "tabular-nums text-right" },
          {
            header: "单件均摊",
            cell: (r) => `¥${Math.round((r.freight + r.tax) / r.orderCount)}`,
            className: "tabular-nums text-right text-primary font-medium",
          },
          { header: "预计到达", cell: (r) => <span className="text-xs text-muted-foreground tabular-nums">{r.eta}</span> },
          { header: "状态", cell: (r) => <StatusBadge>{r.status}</StatusBadge> },
        ]}
      />
    </div>
  );
}
