import { cn } from "@/lib/utils";
import { PARCEL_STATUS_LABEL } from "@/lib/japan-parcel.helpers";

const STATUS_TONE: Record<string, string> = {
  purchased: "bg-blue-50 text-blue-700 border-blue-200",
  at_jp_warehouse: "bg-violet-50 text-violet-700 border-violet-200",
  shipping_intl: "bg-sky-50 text-sky-700 border-sky-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-zinc-100 text-zinc-700 border-zinc-200",
  // legacy
  paid: "bg-blue-50 text-blue-700 border-blue-200",
  warehouse_jp: "bg-violet-50 text-violet-700 border-violet-200",
};

export function ParcelStatusBadge({ status }: { status: string }) {
  const label = PARCEL_STATUS_LABEL[status] ?? status;
  const tone = STATUS_TONE[status] ?? "bg-muted text-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}
