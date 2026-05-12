import { createFileRoute } from "@tanstack/react-router";
import { Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { transfers } from "@/lib/mock-data";

export const Route = createFileRoute("/inventory/transfers")({
  head: () => ({ meta: [{ title: "库存调拨 · 库存" }, { name: "description", content: "总仓与门店之间的库存调拨" }] }),
  component: TransfersPage,
});

function TransfersPage() {
  const total = transfers.reduce((s, t) => s + t.value, 0);
  const totalItems = transfers.reduce((s, t) => s + t.items, 0);

  return (
    <div>
      <PageHeader
        title="库存调拨"
        description="管理总仓与门店之间的货物调拨"
        meta={
          <>
            <span>本月调拨 · {transfers.length} 单</span>
            <span className="text-border">·</span>
            <span>合计 {totalItems} 件 · 价值 ¥{total.toLocaleString()}</span>
          </>
        }
        actions={
          <Button size="sm" className="bg-gradient-brand hover:opacity-90" onClick={() => toast.info("功能开发中")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            新建调拨单
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">快速调拨</CardTitle>
            <p className="text-xs text-muted-foreground">从源仓库选择商品，拖拽至目标门店</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-5 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">源仓库</p>
                <p className="mt-2 text-sm font-medium">总仓 · 上海</p>
                <p className="mt-0.5 text-xs text-muted-foreground">在库 1,284 件</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground shadow-elegant">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="rounded-lg border-2 border-dashed border-primary/30 bg-accent/30 p-5 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">目标门店</p>
                <p className="mt-2 text-sm font-medium">点击选择…</p>
                <p className="mt-0.5 text-xs text-muted-foreground">支持 14 家门店</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">调拨概览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">本月调拨单</span>
              <span className="font-semibold tabular-nums">{transfers.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">合计件数</span>
              <span className="font-semibold tabular-nums">{totalItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">合计价值</span>
              <span className="font-semibold tabular-nums text-primary">¥{total.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">平均时效</span>
              <span className="font-semibold tabular-nums">2.4 天</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        rowKey={(r) => r.id}
        data={transfers}
        columns={[
          { header: "调拨单号", cell: (r) => <span className="font-mono text-xs">{r.id}</span> },
          {
            header: "调拨路径",
            cell: (r) => (
              <div className="flex items-center gap-2 text-sm">
                <span>{r.from}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{r.to}</span>
              </div>
            ),
          },
          { header: "件数", cell: (r) => `${r.items} 件`, className: "tabular-nums text-right" },
          { header: "价值", cell: (r) => `¥${r.value.toLocaleString()}`, className: "tabular-nums text-right" },
          { header: "操作员", cell: (r) => r.operator },
          { header: "日期", cell: (r) => <span className="text-xs text-muted-foreground tabular-nums">{r.date}</span> },
          { header: "状态", cell: (r) => <StatusBadge>{r.status}</StatusBadge> },
        ]}
      />
    </div>
  );
}
