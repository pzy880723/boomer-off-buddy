import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-5 w-1 rounded-full bg-gradient-brand" />
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
