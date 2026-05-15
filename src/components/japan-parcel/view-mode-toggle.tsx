import { useParcelViewMode, type ParcelViewMode } from "@/hooks/use-parcel-view-mode";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ParcelViewMode; label: string }[] = [
  { value: "parcel", label: "包裹" },
  { value: "item", label: "商品" },
];

export function ViewModeToggle({ className }: { className?: string }) {
  const [value, setValue] = useParcelViewMode();
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-background p-0.5 text-xs",
        className,
      )}
      role="group"
      aria-label="展示维度"
    >
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setValue(o.value)}
            className={cn(
              "h-7 rounded px-2 transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
