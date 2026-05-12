import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { ScreenshotDropzone } from "@/components/screenshot-dropzone";
import { ParcelForm, type ParcelFormValue } from "@/components/parcel-form";
import { createJapanParcel } from "@/lib/japan-parcel.functions";
import { recognizeParcelScreenshot } from "@/lib/ai.functions";

const searchSchema = z.object({ tab: z.enum(["manual", "ai"]).default("manual") });

export const Route = createFileRoute("/purchase/japan-parcel/new")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "新建小包裹 · BOOMER OFF" }] }),
  component: NewParcelPage,
});

function NewParcelPage() {
  const nav = useNavigate();
  const { tab } = Route.useSearch();
  const create = useServerFn(createJapanParcel);
  const recognize = useServerFn(recognizeParcelScreenshot);

  const [form, setForm] = useState<ParcelFormValue>({ status: "paid", source: "manual" });
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  const recogMut = useMutation({
    mutationFn: (img: string) => recognize({ data: { image_base64: img, mime_type: "image/png" } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(`识别失败：${r.reason}`);
        return;
      }
      const fields = r.fields as Record<string, unknown>;
      setForm((prev) => ({ ...prev, ...(fields as ParcelFormValue), source: "ai_ocr" }));
      toast.success("识别完成，请复核字段");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveMut = useMutation({
    mutationFn: () => create({ data: form as never }),
    onSuccess: (r) => {
      toast.success("已保存");
      nav({ to: "/purchase/japan-parcel/$id", params: { id: r.row.id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <PageHeader
        title="新建小包裹订单"
        description="支持 AI 截图识别和手动录入"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => nav({ to: "/purchase/japan-parcel" })}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> 返回
            </Button>
            <Button size="sm" className="bg-gradient-brand hover:opacity-90" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> {saveMut.isPending ? "保存中…" : "保存"}
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => nav({ to: "/purchase/japan-parcel/new", search: { tab: v as "manual" | "ai" } })}>
        <TabsList>
          <TabsTrigger value="ai"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI 识图</TabsTrigger>
          <TabsTrigger value="manual">手动录入</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <Card className="mb-4">
            <CardContent className="py-5">
              <ScreenshotDropzone
                preview={imgPreview}
                onImage={(dataUrl) => {
                  setImgPreview(dataUrl);
                }}
              />
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  className="bg-gradient-brand hover:opacity-90"
                  disabled={!imgPreview || recogMut.isPending}
                  onClick={() => imgPreview && recogMut.mutate(imgPreview)}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {recogMut.isPending ? "识别中…" : "开始识别"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <ParcelForm initial={form} onChange={setForm} />
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <ParcelForm initial={form} onChange={setForm} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
