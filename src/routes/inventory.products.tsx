import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Upload, Plus, LayoutGrid, List, MoreHorizontal, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { products } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory/products")({
  head: () => ({ meta: [{ title: "商品档案 · 库存" }, { name: "description", content: "管理商品档案、SKU 与 RFID EPC" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const [view, setView] = useState<"grid" | "table">("grid");

  return (
    <div>
      <PageHeader
        title="商品档案"
        description={`共 ${products.length} 件商品 · ${products.filter((p) => p.rfidEpc).length} 件已绑定 RFID EPC`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast.info("功能开发中")}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              批量导入
            </Button>
            <Button size="sm" className="bg-gradient-brand hover:opacity-90" onClick={() => toast.info("功能开发中")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新增商品
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="按 SKU、名称或品牌搜索…" className="h-9 pl-8" />
        </div>
        <div className="flex items-center rounded-md border bg-background p-0.5">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors",
              view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            网格
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors",
              view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
            表格
          </button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const margin = ((p.retailPrice - p.estimatedCost) / p.retailPrice) * 100;
            return (
              <Card key={p.id} className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute left-2 top-2">
                    <StatusBadge>{p.status}</StatusBadge>
                  </div>
                  {p.rfidEpc && (
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-success text-success-foreground" title={p.rfidEpc}>
                      <Radio className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {p.brand}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {p.category}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{p.sku}</p>
                  <div className="mt-2.5 flex items-end justify-between border-t pt-2.5">
                    <div>
                      <p className="text-[10px] text-muted-foreground">零售价</p>
                      <p className="text-base font-semibold tabular-nums text-primary">¥{p.retailPrice}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">毛利率</p>
                      <p className="text-sm font-medium tabular-nums text-success">{margin.toFixed(0)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <DataTable
          rowKey={(r) => r.id}
          data={products}
          columns={[
            {
              header: "商品",
              cell: (r) => (
                <div className="flex items-center gap-3">
                  <img src={r.image} alt="" className="h-10 w-10 rounded-md object-cover" />
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{r.sku}</div>
                  </div>
                </div>
              ),
            },
            { header: "品牌 / 分类", cell: (r) => <span className="text-xs">{r.brand} · {r.category}</span> },
            { header: "批次", cell: (r) => <span className="font-mono text-xs">{r.batchId}</span> },
            {
              header: "RFID EPC",
              cell: (r) =>
                r.rfidEpc ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-success">
                    <Radio className="h-3 w-3" />
                    {r.rfidEpc}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">未绑定</span>
                ),
            },
            { header: "成本", cell: (r) => `¥${r.estimatedCost}`, className: "tabular-nums text-right" },
            { header: "零售价", cell: (r) => <span className="font-medium text-primary">¥{r.retailPrice}</span>, className: "tabular-nums text-right" },
            { header: "状态", cell: (r) => <StatusBadge>{r.status}</StatusBadge> },
            {
              header: "",
              cell: () => (
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              ),
              className: "w-10",
            },
          ]}
        />
      )}
    </div>
  );
}
