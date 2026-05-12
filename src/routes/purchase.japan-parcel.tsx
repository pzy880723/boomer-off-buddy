import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { japanParcel } from "@/lib/mock-data";

export const Route = createFileRoute("/purchase/japan-parcel")({
  head: () => ({ meta: [{ title: "日本小包裹 · 采购物流" }, { name: "description", content: "EMS/平台直邮订单追踪" }] }),
  component: JapanParcelPage,
});

function JapanParcelPage() {
  return (
    <div>
      <PageHeader
        title="日本小包裹"
        description="Yahoo / Mercari / 乐天等平台单件直邮订单"
        actions={
          <Button size="sm" className="bg-gradient-brand hover:opacity-90" onClick={() => toast.info("功能开发中")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            录入订单
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="按订单号、商品搜索…" className="h-9 pl-8" />
        </div>
        <div className="text-xs text-muted-foreground">共 {japanParcel.length} 单</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {japanParcel.map((p) => (
          <Card key={p.id} className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
            <div className="aspect-square overflow-hidden bg-muted">
              <img
                src={p.image}
                alt={p.item}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
                <StatusBadge>{p.status}</StatusBadge>
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">{p.item}</p>
              <p className="mt-1 text-xs text-muted-foreground">卖家 · {p.seller}</p>
              <div className="mt-2.5 flex items-center justify-between border-t pt-2.5">
                <span className="text-base font-semibold tabular-nums text-primary">¥{p.jpy.toLocaleString()}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">到达 {p.eta}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
