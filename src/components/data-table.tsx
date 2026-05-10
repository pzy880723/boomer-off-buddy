import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function DataTable<T>({
  columns,
  data,
  rowKey,
}: {
  columns: { header: string; cell: (row: T) => ReactNode; className?: string }[];
  data: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={`px-4 py-3 text-left font-medium text-muted-foreground ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((c, i) => (
                  <td key={i} className={`px-4 py-3 ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
