import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  delta,
  icon: Icon,
  prefix = "",
  suffix = "",
  spark,
  hint,
  tone = "default",
}: {
  title: string;
  value: number | string;
  delta?: number;
  icon: LucideIcon;
  prefix?: string;
  suffix?: string;
  spark?: number[];
  hint?: string;
  tone?: "default" | "brand";
}) {
  const positive = (delta ?? 0) >= 0;
  const data = (spark ?? []).map((v, i) => ({ i, v }));
  const display = typeof value === "number" ? value.toLocaleString("zh-CN") : value;

  return (
    <Card className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      {tone === "brand" && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-brand" />
      )}
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
              {prefix}
              {display}
              {suffix && <span className="ml-1 text-base font-normal text-muted-foreground">{suffix}</span>}
            </p>
            {(delta !== undefined || hint) && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {delta !== undefined && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                      positive
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {positive ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(delta)}%
                  </span>
                )}
                {hint && <span className="text-muted-foreground">{hint}</span>}
              </div>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              tone === "brand"
                ? "bg-gradient-brand text-primary-foreground shadow-elegant"
                : "bg-accent text-accent-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {data.length > 0 && (
          <div className="mt-3 -mx-2 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--color-primary)"
                  strokeWidth={1.5}
                  fill={`url(#spark-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
