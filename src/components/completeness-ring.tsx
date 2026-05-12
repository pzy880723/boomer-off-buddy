import { cn } from "@/lib/utils";

export function CompletenessRing({ value, size = 36 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  const tone =
    v >= 90 ? "text-emerald-600" : v >= 60 ? "text-amber-500" : "text-destructive";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={3}
          className="text-muted opacity-30" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={3}
          className={cn(tone)} fill="none" strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <span className={cn("absolute text-[10px] font-semibold", tone)}>{v}</span>
    </div>
  );
}
