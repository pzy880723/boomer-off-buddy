import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { knowledgeArticles } from "@/lib/mock-data";

export const Route = createFileRoute("/knowledge")({
  head: () => ({ meta: [{ title: "知识库 · BOOMER OFF" }, { name: "description", content: "商品知识、SOP、QA 与装修流程" }] }),
  component: KnowledgePage,
});

const categories = ["全部", "商品知识", "SOP", "QA", "装修流程"] as const;

function KnowledgePage() {
  const [active, setActive] = useState<(typeof categories)[number]>("全部");
  const list =
    active === "全部" ? knowledgeArticles : knowledgeArticles.filter((a) => a.type === active);

  return (
    <div>
      <PageHeader
        title="知识库"
        description="商品知识、标准 SOP 与加盟商培训资料"
        actions={
          <Button onClick={() => toast.info("功能开发中")}>
            <Plus className="h-4 w-4 mr-2" />
            新增文章
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <Card className="p-2 h-fit">
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={c}>
                <button
                  onClick={() => setActive(c)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    active === c
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-2">
          {list.map((a) => (
            <Card key={a.id} className="hover:shadow-sm transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{a.type}</Badge>
                    <span className="text-xs text-muted-foreground">更新于 {a.updated}</span>
                  </div>
                  <p className="font-medium">{a.title}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
