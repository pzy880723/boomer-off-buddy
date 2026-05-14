import { CheckCircle2, Circle, Loader2, AlertCircle, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "running" | "done" | "error" | "warn";

export interface TimelineStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;          // 一行小字
  durationMs?: number;
  payload?: unknown;        // 抽到的 JSON，可展开看
  errorMsg?: string;
}

export function RecognizeTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
      {steps.map((s) => (
        <Row key={s.id} step={s} />
      ))}
    </div>
  );
}

function Row({ step }: { step: TimelineStep }) {
  const [open, setOpen] = useState(false);
  const expandable = step.payload != null || step.errorMsg;
  return (
    <div className="text-xs">
      <div
        className={cn(
          "flex items-center gap-2 rounded px-1.5 py-1",
          expandable && "cursor-pointer hover:bg-muted",
        )}
        onClick={() => expandable && setOpen((v) => !v)}
      >
        <Icon status={step.status} />
        <span
          className={cn(
            "font-medium",
            step.status === "error" && "text-destructive",
            step.status === "warn" && "text-amber-600",
            step.status === "pending" && "text-muted-foreground",
          )}
        >
          {step.label}
        </span>
        {step.detail && (
          <span className="truncate text-muted-foreground">— {step.detail}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-muted-foreground">
          {step.durationMs != null && <span>{formatMs(step.durationMs)}</span>}
          {expandable && (
            <ChevronRight
              className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
            />
          )}
        </span>
      </div>
      {open && expandable && (
        <div className="ml-6 mt-1 rounded border bg-background p-2">
          {step.errorMsg && (
            <div className="mb-1 text-destructive">{step.errorMsg}</div>
          )}
          {step.payload != null && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-muted-foreground">
              {JSON.stringify(step.payload, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Icon({ status }: { status: StepStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case "error":
      return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    case "warn":
      return <AlertCircle className="h-3.5 w-3.5 text-amber-500" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
