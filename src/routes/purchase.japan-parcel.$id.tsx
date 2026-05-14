import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ParcelEditPanel } from "@/components/japan-parcel/parcel-edit-panel";

export const Route = createFileRoute("/purchase/japan-parcel/$id")({
  head: () => ({ meta: [{ title: "小包裹详情 · BOOMER OFF" }] }),
  component: ParcelDetail,
});

function ParcelDetail() {
  const { id } = Route.useParams();
  return (
    <div>
      <PageHeader
        title="小包裹详情"
        description="可直接在此页编辑，也可在列表中以弹窗形式编辑"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/purchase/japan-parcel">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> 返回列表
            </Link>
          </Button>
        }
      />
      <ParcelEditPanel parcelId={id} />
    </div>
  );
}
