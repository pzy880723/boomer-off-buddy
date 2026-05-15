import { useCurrencyDisplay, type CurrencyDisplay } from "@/hooks/use-currency-display";
import { cn } from "@/lib/utils";

const OPTIONS: { value: CurrencyDisplay; label: string }[] = [
  { value: "jpy", label: "日元" },
  { value: "cny", label: "人民币" },
  { value: "both", label: "同时" },
];

export function CurrencyToggle({ className }: { className?: string }) {
  const [value, setValue] = useCurrencyDisplay();
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border bg-background p-0.5 text-xs",
        className,
      )}
      role="group"
      aria-label="币种显示"
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
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
