import { cn } from "@/lib/utils";
import { PARCEL_STATUS_LABEL, type ParcelStatus } from "@/lib/japan-parcel.helpers";

const STATUS_TONE: Record<ParcelStatus, string> = {
  bidding: "bg-amber-50 text-amber-700 border-amber-200",
  paid: "bg-blue-50 text-blue-700 border-blue-200",
  warehouse_jp: "bg-violet-50 text-violet-700 border-violet-200",
  shipping_intl: "bg-sky-50 text-sky-700 border-sky-200",
  customs: "bg-orange-50 text-orange-700 border-orange-200",
  shipping_cn: "bg-cyan-50 text-cyan-700 border-cyan-200",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function ParcelStatusBadge({ status }: { status: string }) {
  const key = status as ParcelStatus;
  const label = PARCEL_STATUS_LABEL[key] ?? status;
  const tone = STATUS_TONE[key] ?? "bg-muted text-foreground border-border";
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
