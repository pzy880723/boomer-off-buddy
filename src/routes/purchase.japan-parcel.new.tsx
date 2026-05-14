import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, Sparkles, Plus, X, Image as ImageIcon, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { ScreenshotDropzone } from "@/components/screenshot-dropzone";
import { PARCEL_STATUS_OPTIONS, formatJpy, formatCny } from "@/lib/japan-parcel.helpers";
import { createJapanParcel, bulkCreateParcelItems } from "@/lib/japan-parcel.functions";
import {
  segmentParcelText,
  ocrAndSegment,
  extractParcelInfo,
  extractIntlFee,
  extractSubItem,
} from "@/lib/recognize.functions";
import {
  RecognizeTimeline,
  type TimelineStep,
} from "@/components/japan-parcel/recognize-timeline";

export const Route = createFileRoute("/purchase/japan-parcel/new")({
  head: () => ({ meta: [{ title: "新建小包裹 · BOOMER OFF" }] }),
  component: NewParcelPage,
});

// ====== Types ======
type Num = number | null;
type Str = string | null;

interface ParcelInfo {
  source_order_no: Str;
  tracking_no: Str;
  status: string;
  status_text: Str;
  total_weight_g: Num;
  volume_cm3: Num;
  max_side_cm: Num;
  storage_days: Num;
  receiver_name: Str;
  receiver_phone: Str;
  receiver_address: Str;
}

interface IntlFee {
  intl_total_jpy: Num;
  intl_exchange_rate: Num;
  intl_pay_method: Str;
  intl_pay_at: Str;
  intl_merchant_order_no: Str;
  intl_freight_jpy: Num;
  intl_ship_method: Str;
  intl_charge_method: Str;
  intl_keep_packaging_jpy: Num;
  intl_reinforce_jpy: Num;
  intl_send_fee_jpy: Num;
  intl_photo_fee_jpy: Num;
  intl_merge_fee_jpy: Num;
  intl_points_used: Num;
}

interface SubItem {
  _key: string;
  sub_order_no: Str;
  item_title: Str;
  item_title_cn: Str;
  item_image_url: Str;
  item_total_jpy: Num;
  item_total_cny: Num;
  unit_price_jpy: Num;
  quantity: Num;
  service_fee_jpy: Num;
  domestic_freight_jpy: Num;
  freight_diff_jpy: Num;
  weight_g: Num;
  exchange_rate: Num;
  pay_method: Str;
  pay_at: Str;
  merchant_order_no: Str;
}

const emptyParcel = (): ParcelInfo => ({
  source_order_no: null,
  tracking_no: null,
  status: "purchased",
  status_text: null,
  total_weight_g: null,
  volume_cm3: null,
  max_side_cm: null,
  storage_days: null,
  receiver_name: null,
  receiver_phone: null,
  receiver_address: null,
});
const emptyIntl = (): IntlFee => ({
  intl_total_jpy: null,
  intl_exchange_rate: null,
  intl_pay_method: null,
  intl_pay_at: null,
  intl_merchant_order_no: null,
  intl_freight_jpy: null,
  intl_ship_method: null,
  intl_charge_method: null,
  intl_keep_packaging_jpy: null,
  intl_reinforce_jpy: null,
  intl_send_fee_jpy: null,
  intl_photo_fee_jpy: null,
  intl_merge_fee_jpy: null,
  intl_points_used: null,
});
const emptyItem = (): SubItem => ({
  _key: crypto.randomUUID(),
  sub_order_no: null,
  item_title: null,
  item_title_cn: null,
  item_image_url: null,
  item_total_jpy: null,
  item_total_cny: null,
  unit_price_jpy: null,
  quantity: 1,
  service_fee_jpy: null,
  domestic_freight_jpy: null,
  freight_diff_jpy: null,
  weight_g: null,
  exchange_rate: null,
  pay_method: null,
  pay_at: null,
  merchant_order_no: null,
});

// ====== Tariff (placeholder rule, configurable later) ======
const TARIFF_RATE = 0; // 0% — 业务确认后再调整

// ====== Field component ======
function F({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string | number | null) => void;
  type?: "text" | "number" | "datetime";
  placeholder?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="h-9"
        type={type === "number" ? "number" : type === "datetime" ? "datetime-local" : "text"}
        placeholder={placeholder}
        value={
          value == null
            ? ""
            : type === "datetime" && typeof value === "string"
            ? value.slice(0, 16)
            : (value as string | number)
        }
        onChange={(e) => {
          const raw = e.target.value;
          if (type === "number") onChange(raw === "" ? null : Number(raw));
          else if (type === "datetime") onChange(raw ? new Date(raw).toISOString() : null);
          else onChange(raw || null);
        }}
      />
    </div>
  );
}

// ====== Page ======
function NewParcelPage() {
  const nav = useNavigate();
  const create = useServerFn(createJapanParcel);
  const bulkItems = useServerFn(bulkCreateParcelItems);
  const recognize = useServerFn(recognizeParcelBlock);

  const [parcel, setParcel] = useState<ParcelInfo>(emptyParcel());
  const [intl, setIntl] = useState<IntlFee>(emptyIntl());
  const [items, setItems] = useState<SubItem[]>([emptyItem()]);

  const [smartTab, setSmartTab] = useState<"text" | "image">("text");
  const [smartText, setSmartText] = useState("");
  const [smartImage, setSmartImage] = useState<string | null>(null);
  const [usedAi, setUsedAi] = useState(false);

  // ====== Smart fill ======
  const recogMut = useMutation({
    mutationFn: () =>
      recognize({
        data: {
          text: smartTab === "text" && smartText.trim() ? smartText.trim() : undefined,
          image_base64: smartTab === "image" && smartImage ? smartImage : undefined,
          mime_type: "image/png",
        },
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(`识别失败：${r.reason}`);
        return;
      }
      const out = r.data;
      if (out.parcel)
        setParcel((p) => ({
          ...p,
          ...Object.fromEntries(Object.entries(out.parcel!).filter(([, v]) => v != null)),
        }));
      if (out.intl_fee)
        setIntl((i) => ({
          ...i,
          ...Object.fromEntries(Object.entries(out.intl_fee!).filter(([, v]) => v != null)),
        }));
      if (out.items?.length) {
        setItems(
          out.items.map((it) => ({
            ...emptyItem(),
            ...Object.fromEntries(Object.entries(it).filter(([, v]) => v != null)),
          })),
        );
      }
      setUsedAi(true);
      toast.success(`识别完成，共 ${out.items?.length ?? 0} 个子订单`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // ====== Totals ======
  const totals = useMemo(() => {
    const itemsTotalJpy = items.reduce((s, it) => s + (Number(it.item_total_jpy) || 0), 0);
    const intlTotalJpy = Number(intl.intl_total_jpy) || 0;
    const tariffJpy = Math.round(itemsTotalJpy * TARIFF_RATE);
    const grandJpy = itemsTotalJpy + intlTotalJpy + tariffJpy;
    const rate = Number(intl.intl_exchange_rate) || 0;
    const grandCny = rate ? +(grandJpy * rate).toFixed(2) : 0;
    const tariffCny = rate ? +(tariffJpy * rate).toFixed(2) : 0;
    return { itemsTotalJpy, intlTotalJpy, tariffJpy, grandJpy, grandCny, tariffCny };
  }, [items, intl.intl_total_jpy, intl.intl_exchange_rate]);

  // ====== Save ======
  const saveMut = useMutation({
    mutationFn: async () => {
      const r = await create({
        data: {
          source: usedAi ? "ai_ocr" : "manual",
          ...parcel,
          ...intl,
          tariff_jpy: totals.tariffJpy || null,
          tariff_cny: totals.tariffCny || null,
          grand_total_jpy: totals.grandJpy || null,
          grand_total_cny: totals.grandCny || null,
        },
      });
      const parentId = r.row.id;
      const valid = items.filter(
        (it) => it.item_title || it.item_title_cn || it.sub_order_no || it.item_total_jpy,
      );
      if (valid.length) {
        await bulkItems({
          data: {
            items: valid.map((it, idx) => {
              const { _key: _drop, ...rest } = it;
              void _drop;
              return { ...rest, parent_id: parentId, position: idx };
            }),
          },
        });
      }
      return r.row.id;
    },
    onSuccess: (id) => {
      toast.success("已保存");
      nav({ to: "/purchase/japan-parcel/$id", params: { id } });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateItem = (key: string, patch: Partial<SubItem>) =>
    setItems((arr) => arr.map((it) => (it._key === key ? { ...it, ...patch } : it)));

  return (
    <div className="space-y-5">
      <PageHeader
        title="新建小包裹订单"
        description="智能填充 + 三段式表单，一次保存包裹与所有子订单"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => nav({ to: "/purchase/japan-parcel" })}>
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> 返回
            </Button>
            <Button
              size="sm"
              className="bg-gradient-brand hover:opacity-90"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saveMut.isPending ? "保存中…" : "保存"}
            </Button>
          </>
        }
      />

      {/* Smart fill */}
      <Card className="border-primary/30">
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
                recogMut.isPending ||
                (smartTab === "text" ? !smartText.trim() : !smartImage)
              }
              onClick={() => recogMut.mutate()}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {recogMut.isPending ? "识别中…" : "一键识别并填充"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 1. 订单信息 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">① 订单信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <F label="订单号" value={parcel.source_order_no} onChange={(v) => setParcel({ ...parcel, source_order_no: v as Str })} />
          <F label="国际物流单号" value={parcel.tracking_no} onChange={(v) => setParcel({ ...parcel, tracking_no: v as Str })} />
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">状态</Label>
            <Select value={parcel.status} onValueChange={(v) => setParcel({ ...parcel, status: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARCEL_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <F label="重量（含包装，g）" type="number" value={parcel.total_weight_g} onChange={(v) => setParcel({ ...parcel, total_weight_g: v as Num })} />
          <F label="体积 (cm³)" type="number" value={parcel.volume_cm3} onChange={(v) => setParcel({ ...parcel, volume_cm3: v as Num })} />
          <F label="最大边长 (cm)" type="number" value={parcel.max_side_cm} onChange={(v) => setParcel({ ...parcel, max_side_cm: v as Num })} />
          <F label="存储天数" type="number" value={parcel.storage_days} onChange={(v) => setParcel({ ...parcel, storage_days: v as Num })} />
          <F label="状态文字（原始）" value={parcel.status_text} onChange={(v) => setParcel({ ...parcel, status_text: v as Str })} />
          <div />
          <F label="收货人" value={parcel.receiver_name} onChange={(v) => setParcel({ ...parcel, receiver_name: v as Str })} />
          <F label="电话" value={parcel.receiver_phone} onChange={(v) => setParcel({ ...parcel, receiver_phone: v as Str })} />
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground">收货地址</Label>
            <Textarea
              rows={2}
              value={parcel.receiver_address ?? ""}
              onChange={(e) => setParcel({ ...parcel, receiver_address: e.target.value || null })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. 国际物流费用明细 */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">② 国际物流费用明细</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <F label="国际物流总计（JPY）" type="number" value={intl.intl_total_jpy} onChange={(v) => setIntl({ ...intl, intl_total_jpy: v as Num })} />
          <F label="结算汇率（1 JPY = ? CNY）" type="number" value={intl.intl_exchange_rate} onChange={(v) => setIntl({ ...intl, intl_exchange_rate: v as Num })} placeholder="如 0.0481" />
          <F label="商户订单号" value={intl.intl_merchant_order_no} onChange={(v) => setIntl({ ...intl, intl_merchant_order_no: v as Str })} />
          <F label="支付方式" value={intl.intl_pay_method} onChange={(v) => setIntl({ ...intl, intl_pay_method: v as Str })} />
          <F label="支付时间" type="datetime" value={intl.intl_pay_at} onChange={(v) => setIntl({ ...intl, intl_pay_at: v as Str })} />
          <F label="国际物流费（JPY）" type="number" value={intl.intl_freight_jpy} onChange={(v) => setIntl({ ...intl, intl_freight_jpy: v as Num })} />
          <F label="发送方式" value={intl.intl_ship_method} onChange={(v) => setIntl({ ...intl, intl_ship_method: v as Str })} placeholder="日本邮政 海运件" />
          <F label="收费方式" value={intl.intl_charge_method} onChange={(v) => setIntl({ ...intl, intl_charge_method: v as Str })} placeholder="按重量收费 18,500g" />
          <F label="保留原始包装（JPY）" type="number" value={intl.intl_keep_packaging_jpy} onChange={(v) => setIntl({ ...intl, intl_keep_packaging_jpy: v as Num })} />
          <F label="强化加固（JPY）" type="number" value={intl.intl_reinforce_jpy} onChange={(v) => setIntl({ ...intl, intl_reinforce_jpy: v as Num })} />
          <F label="发送手续费（JPY）" type="number" value={intl.intl_send_fee_jpy} onChange={(v) => setIntl({ ...intl, intl_send_fee_jpy: v as Num })} />
          <F label="拍照费（JPY）" type="number" value={intl.intl_photo_fee_jpy} onChange={(v) => setIntl({ ...intl, intl_photo_fee_jpy: v as Num })} />
          <F label="合单手续费（JPY）" type="number" value={intl.intl_merge_fee_jpy} onChange={(v) => setIntl({ ...intl, intl_merge_fee_jpy: v as Num })} />
          <F label="已使用积分" type="number" value={intl.intl_points_used} onChange={(v) => setIntl({ ...intl, intl_points_used: v as Num })} />
        </CardContent>
      </Card>

      {/* 3. 子订单 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-sm font-semibold">
            ③ 子订单 / 包裹内物品（{items.length} 件）
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setItems([...items, emptyItem()])}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> 新增子订单
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((it, idx) => (
            <div key={it._key} className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-medium">子订单 #{idx + 1}</div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => setItems((arr) => arr.filter((x) => x._key !== it._key))}
                  disabled={items.length === 1}
                  aria-label="删除"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <F label="商品标题（日）" value={it.item_title} onChange={(v) => updateItem(it._key, { item_title: v as Str })} />
                <F label="商品标题（中）" value={it.item_title_cn} onChange={(v) => updateItem(it._key, { item_title_cn: v as Str })} />
                <F label="商品图 URL" value={it.item_image_url} onChange={(v) => updateItem(it._key, { item_image_url: v as Str })} />
                <F label="商品费用 JPY" type="number" value={it.item_total_jpy} onChange={(v) => updateItem(it._key, { item_total_jpy: v as Num })} />
                <F label="≈ CNY" type="number" value={it.item_total_cny} onChange={(v) => updateItem(it._key, { item_total_cny: v as Num })} />
                <F label="结算汇率" type="number" value={it.exchange_rate} onChange={(v) => updateItem(it._key, { exchange_rate: v as Num })} />
                <F label="订单编号" value={it.sub_order_no} onChange={(v) => updateItem(it._key, { sub_order_no: v as Str })} />
                <F label="商户订单号" value={it.merchant_order_no} onChange={(v) => updateItem(it._key, { merchant_order_no: v as Str })} />
                <F label="入库重量（g）" type="number" value={it.weight_g} onChange={(v) => updateItem(it._key, { weight_g: v as Num })} />
                <F label="商品价格（JPY）" type="number" value={it.unit_price_jpy} onChange={(v) => updateItem(it._key, { unit_price_jpy: v as Num })} />
                <F label="数量" type="number" value={it.quantity} onChange={(v) => updateItem(it._key, { quantity: v as Num })} />
                <F label="手续费（JPY）" type="number" value={it.service_fee_jpy} onChange={(v) => updateItem(it._key, { service_fee_jpy: v as Num })} />
                <F label="日本国内运费（JPY）" type="number" value={it.domestic_freight_jpy} onChange={(v) => updateItem(it._key, { domestic_freight_jpy: v as Num })} />
                <F label="运费补差（JPY）" type="number" value={it.freight_diff_jpy} onChange={(v) => updateItem(it._key, { freight_diff_jpy: v as Num })} />
                <F label="支付方式" value={it.pay_method} onChange={(v) => updateItem(it._key, { pay_method: v as Str })} />
                <F label="支付时间" type="datetime" value={it.pay_at} onChange={(v) => updateItem(it._key, { pay_at: v as Str })} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">合计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">商品总额（{items.length} 件）</span>
              <span className="font-mono">{formatJpy(totals.itemsTotalJpy)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">+ 国际物流费</span>
              <span className="font-mono">{formatJpy(totals.intlTotalJpy)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                + 关税（{(TARIFF_RATE * 100).toFixed(0)}%，可后续配置）
              </span>
              <span className="font-mono">{formatJpy(totals.tariffJpy)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-semibold">
              <span>= 合计</span>
              <span className="font-mono">
                {formatJpy(totals.grandJpy)}
                {totals.grandCny > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    (≈ {formatCny(totals.grandCny)})
                  </span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
