import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "info" | "danger" | "neutral" | "brand";

const toneMap: Record<Tone, { dot: string; text: string; bg: string; border: string }> = {
  success: { dot: "bg-success", text: "text-success", bg: "bg-success/10", border: "border-success/20" },
  warning: { dot: "bg-warning", text: "text-warning-foreground", bg: "bg-warning/15", border: "border-warning/30" },
  info: { dot: "bg-info", text: "text-info", bg: "bg-info/10", border: "border-info/20" },
  danger: { dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20" },
  neutral: { dot: "bg-muted-foreground", text: "text-foreground", bg: "bg-muted", border: "border-border" },
  brand: { dot: "bg-primary", text: "text-primary", bg: "bg-accent", border: "border-primary/20" },
};

const presetMap: Record<string, Tone> = {
  已入库: "success",
  已签收: "success",
  已收货: "success",
  营业中: "success",
  已发货: "info",
  运输中: "info",
  派送中: "info",
  待发货: "warning",
  清关中: "warning",
  装修中: "warning",
  异常: "danger",
  在库: "success",
  已售出: "neutral",
  已调拨: "info",
  直营: "brand",
  加盟: "info",
};

export function StatusBadge({ children, tone }: { children: string; tone?: Tone }) {
  const resolvedTone = tone ?? presetMap[children] ?? "neutral";
  const t = toneMap[resolvedTone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        t.bg,
        t.text,
        t.border,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}
