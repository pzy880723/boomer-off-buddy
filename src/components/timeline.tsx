import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  time: string;
  tone?: "primary" | "success" | "info" | "warning" | "muted";
};

const toneClass: Record<NonNullable<TimelineItem["tone"]>, string> = {
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  info: "bg-info text-info-foreground",
  warning: "bg-warning text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-5">
      <span className="absolute left-3.5 top-2 bottom-2 w-px bg-border" aria-hidden />
      {items.map((item) => (
        <li key={item.id} className="relative flex gap-3">
          <div
            className={cn(
              "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
              toneClass[item.tone ?? "muted"],
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium leading-tight">{item.title}</p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.time}</span>
            </div>
            {item.description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
