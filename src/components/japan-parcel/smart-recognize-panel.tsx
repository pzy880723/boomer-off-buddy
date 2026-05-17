import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, Image as ImageIcon, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenshotDropzone } from "@/components/screenshot-dropzone";
import {
  RecognizeTimeline,
  type TimelineStep,
} from "@/components/japan-parcel/recognize-timeline";
import {
  segmentParcelText,
  ocrAndSegment,
  extractParcelInfo,
  extractIntlFee,
  extractSubItem,
  peekOrderNo,
} from "@/lib/recognize.functions";
import { lookupExistingParcelByOrderNo } from "@/lib/japan-parcel.functions";
import { translateTitles } from "@/lib/translate.functions";
import { classifyItemsTariff } from "@/lib/tariff.functions";
import { TARIFF_CATEGORIES } from "@/lib/tariff";

export interface RecognizedResult {
  parcel: Record<string, unknown>;
  intl: Record<string, unknown> | null;
  items: Array<Record<string, unknown>>;
}

interface Props {
  onApply: (r: RecognizedResult) => void;
}

export function SmartRecognizePanel({ onApply }: Props) {
  const fnSegmentText = useServerFn(segmentParcelText);
  const fnOcrSegment = useServerFn(ocrAndSegment);
  const fnExtractParcel = useServerFn(extractParcelInfo);
  const fnExtractIntl = useServerFn(extractIntlFee);
  const fnExtractItem = useServerFn(extractSubItem);
  const fnTranslate = useServerFn(translateTitles);
  const fnClassify = useServerFn(classifyItemsTariff);

  const [smartTab, setSmartTab] = useState<"text" | "image">("text");
  const [smartText, setSmartText] = useState("");
  const [smartImage, setSmartImage] = useState<string | null>(null);
  const [tlSteps, setTlSteps] = useState<TimelineStep[]>([]);
  const [running, setRunning] = useState(false);

  const upsertStep = (s: TimelineStep) =>
    setTlSteps((arr) => {
      const i = arr.findIndex((x) => x.id === s.id);
      if (i < 0) return [...arr, s];
      const next = arr.slice();
      next[i] = { ...next[i], ...s };
      return next;
    });

  const runPipeline = async () => {
    setRunning(true);
    setTlSteps([]);
    const startedAt = Date.now();
    try {
      let segments: {
        parcel_block: string | null;
        intl_fee_block: string | null;
        item_blocks: string[];
        hints: {
          source_order_no: string | null;
          tracking_no: string | null;
          status_text: string | null;
          sub_order_nos: string[];
        };
        raw_chars: number;
        cleaned_chars: number;
      };
      if (smartTab === "image" && smartImage) {
        upsertStep({ id: "ocr", label: "图片 OCR", status: "running", detail: "调用视觉模型读取文字…" });
        const t0 = Date.now();
        const r = await fnOcrSegment({ data: { image_base64: smartImage, mime_type: "image/png" } });
        if (!r.ok) {
          upsertStep({ id: "ocr", label: "图片 OCR", status: "error", errorMsg: r.reason, durationMs: Date.now() - t0 });
          throw new Error(r.reason);
        }
        segments = r.segments;
        upsertStep({
          id: "ocr",
          label: "图片 OCR",
          status: "done",
          detail: `读取 ${r.ocr_text.length} 字符`,
          durationMs: Date.now() - t0,
          payload: { ocr_text: r.ocr_text.slice(0, 500) + (r.ocr_text.length > 500 ? "…" : "") },
        });
      } else {
        upsertStep({ id: "seg", label: "预处理 + 分段", status: "running" });
        const t0 = Date.now();
        const r = await fnSegmentText({ data: { text: smartText.trim() } });
        segments = r.segments;
        upsertStep({
          id: "seg",
          label: "预处理 + 分段",
          status: "done",
          detail: `去噪 ${segments.raw_chars} → ${segments.cleaned_chars} 字符`,
          durationMs: Date.now() - t0,
        });
      }

      const segSummary = `parcel:${segments.parcel_block ? "✓" : "✗"} · intl:${segments.intl_fee_block ? "✓" : "✗"} · 子订单 ${segments.item_blocks.length}${segments.hints.source_order_no ? " · 订单号已锁定" : ""}`;
      upsertStep({
        id: "seg-result",
        label: "区块识别",
        status: segments.parcel_block || segments.item_blocks.length ? "done" : "warn",
        detail: segSummary,
        payload: {
          hints: segments.hints,
          parcel_block: segments.parcel_block?.slice(0, 300),
          intl_fee_block: segments.intl_fee_block?.slice(0, 300),
          item_blocks_preview: segments.item_blocks.map((b) => b.slice(0, 120)),
        },
      });

      const tasks: Promise<unknown>[] = [];
      let parcelData: Record<string, unknown> | null = null;
      let intlData: Record<string, unknown> | null = null;
      const itemsData: Array<Record<string, unknown> | null> = new Array(segments.item_blocks.length).fill(null);

      if (segments.parcel_block) {
        upsertStep({ id: "ex-parcel", label: "抽取：包裹信息", status: "running" });
        const t0 = Date.now();
        tasks.push(
          fnExtractParcel({ data: { block: segments.parcel_block } }).then((r) => {
            parcelData = r.data as Record<string, unknown>;
            const filled = Object.values(r.data).filter((v) => v != null).length;
            upsertStep({
              id: "ex-parcel",
              label: "抽取：包裹信息",
              status: r.ok ? "done" : "warn",
              detail: `${filled} 字段 · ${r.model.split("/").pop()}${r.attempts > 1 ? ` · 重试${r.attempts}` : ""}`,
              durationMs: Date.now() - t0,
              payload: r.data,
              errorMsg: r.ok ? undefined : r.reason,
            });
          }),
        );
      }

      if (segments.intl_fee_block) {
        upsertStep({ id: "ex-intl", label: "抽取：国际物流费用", status: "running" });
        const t0 = Date.now();
        tasks.push(
          fnExtractIntl({ data: { block: segments.intl_fee_block } }).then((r) => {
            intlData = r.data as Record<string, unknown>;
            const filled = Object.values(r.data).filter((v) => v != null).length;
            upsertStep({
              id: "ex-intl",
              label: "抽取：国际物流费用",
              status: r.ok ? "done" : "warn",
              detail: `${filled} 字段 · ${r.model.split("/").pop()}${r.attempts > 1 ? ` · 重试${r.attempts}` : ""}`,
              durationMs: Date.now() - t0,
              payload: r.data,
              errorMsg: r.ok ? undefined : r.reason,
            });
          }),
        );
      }

      segments.item_blocks.forEach((blk, idx) => {
        const id = `ex-item-${idx}`;
        upsertStep({ id, label: `抽取:子订单 #${idx + 1}`, status: "running" });
        const t0 = Date.now();
        tasks.push(
          fnExtractItem({ data: { block: blk, index: idx } }).then((r) => {
            itemsData[idx] = r.data as Record<string, unknown>;
            const filled = Object.values(r.data).filter((v) => v != null).length;
            upsertStep({
              id,
              label: `抽取:子订单 #${idx + 1}`,
              status: r.ok ? "done" : "warn",
              detail: `${filled} 字段 · ${r.model.split("/").pop()}${r.attempts > 1 ? ` · 重试${r.attempts}` : ""}`,
              durationMs: Date.now() - t0,
              payload: r.data,
              errorMsg: r.ok ? undefined : r.reason,
            });
          }),
        );
      });

      await Promise.all(tasks);

      const parcelMerged: Record<string, unknown> = { ...(parcelData ?? {}) };
      if (segments.hints.source_order_no && !parcelMerged.source_order_no)
        parcelMerged.source_order_no = segments.hints.source_order_no;
      if (segments.hints.tracking_no && !parcelMerged.tracking_no)
        parcelMerged.tracking_no = segments.hints.tracking_no;
      if (segments.hints.status_text && !parcelMerged.status_text)
        parcelMerged.status_text = segments.hints.status_text;

      const validItems = itemsData.map((it, idx) => {
        const merged = (it ?? {}) as Record<string, unknown>;
        const hint = segments.hints.sub_order_nos[idx];
        if (hint && !merged.sub_order_no) merged.sub_order_no = hint;
        return Object.keys(merged).length ? merged : null;
      }).filter(Boolean) as Record<string, unknown>[];

      // Translate
      const toTranslate = validItems
        .map((it, idx) => ({ idx, jp: (it.item_title as string | null) ?? null, cn: (it.item_title_cn as string | null) ?? null }))
        .filter((x) => x.jp && !x.cn);
      if (toTranslate.length) {
        upsertStep({ id: "translate", label: "翻译子订单标题", status: "running", detail: `${toTranslate.length} 条` });
        const t0 = Date.now();
        try {
          const tr = await fnTranslate({ data: { titles: toTranslate.map((x) => x.jp!) } });
          if (tr.ok) {
            toTranslate.forEach((x, i) => {
              const cn = tr.translations[i];
              if (cn) validItems[x.idx].item_title_cn = cn;
            });
          }
          upsertStep({ id: "translate", label: "翻译子订单标题", status: tr.ok ? "done" : "warn", detail: `${toTranslate.length} 条 · ${((Date.now() - t0) / 1000).toFixed(1)}s`, durationMs: Date.now() - t0 });
        } catch (e) {
          upsertStep({ id: "translate", label: "翻译子订单标题", status: "warn", errorMsg: (e as Error).message });
        }
      }

      // Tariff classify
      const classifyInput = validItems
        .map((it, idx) => ({
          id: `idx-${idx}`,
          item_title: (it.item_title as string | null) ?? null,
          item_title_cn: (it.item_title_cn as string | null) ?? null,
        }))
        .filter((x) => x.item_title || x.item_title_cn);
      if (classifyInput.length) {
        upsertStep({ id: "tariff", label: "关税分类", status: "running", detail: `${classifyInput.length} 条` });
        const t0 = Date.now();
        try {
          const cl = await fnClassify({ data: { items: classifyInput, persist: false } });
          for (const r of cl.results) {
            const cat = TARIFF_CATEGORIES.find((c) => c.key === r.category);
            const idx = Number(r.id.replace("idx-", ""));
            if (cat && validItems[idx]) {
              validItems[idx].tariff_category = cat.key;
              validItems[idx].tariff_rate = cat.rate;
            }
          }
          upsertStep({ id: "tariff", label: "关税分类", status: "done", detail: `${cl.results.length} 条 · ${((Date.now() - t0) / 1000).toFixed(1)}s`, durationMs: Date.now() - t0 });
        } catch (e) {
          upsertStep({ id: "tariff", label: "关税分类", status: "warn", errorMsg: (e as Error).message });
        }
      }

      onApply({ parcel: parcelMerged, intl: intlData, items: validItems });

      upsertStep({
        id: "done",
        label: "完成",
        status: "done",
        detail: `共 ${validItems.length} 个子订单 · 总耗时 ${(((Date.now() - startedAt) / 1000)).toFixed(1)}s`,
      });
      toast.success(`识别完成，共 ${validItems.length} 个子订单`);
    } catch (e) {
      upsertStep({ id: "fail", label: "识别失败", status: "error", errorMsg: (e as Error).message });
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-card">
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          智能填写（粘贴页面文字 或 截图，一键识别）
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={smartTab} onValueChange={(v) => setSmartTab(v as "text" | "image")}>
          <TabsList>
            <TabsTrigger value="text">
              <Type className="mr-1.5 h-3.5 w-3.5" /> 粘贴文字
            </TabsTrigger>
            <TabsTrigger value="image">
              <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> 粘贴截图
            </TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-3">
            <Textarea
              rows={6}
              placeholder="将网页上的订单/物流费用/商品信息整段复制粘贴到这里…"
              value={smartText}
              onChange={(e) => setSmartText(e.target.value)}
            />
          </TabsContent>
          <TabsContent value="image" className="mt-3">
            <ScreenshotDropzone
              preview={smartImage}
              onImage={(dataUrl) => setSmartImage(dataUrl)}
            />
          </TabsContent>
        </Tabs>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            className="bg-gradient-brand hover:opacity-90"
            disabled={
              running || (smartTab === "text" ? !smartText.trim() : !smartImage)
            }
            onClick={runPipeline}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {running ? "识别中…" : "一键识别并填充"}
          </Button>
        </div>

        {tlSteps.length > 0 && (
          <div className="mt-3">
            <RecognizeTimeline steps={tlSteps} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SmartRecognizePanel;
