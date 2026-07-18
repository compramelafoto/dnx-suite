import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type AdminDataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  hideOnMobile?: boolean;
};

type Props<T> = {
  columns: AdminDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  mobileCard?: (row: T) => ReactNode;
  className?: string;
};

export function AdminDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "Sin registros.",
  mobileCard,
  className,
}: Props<T>) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-8 text-center text-sm text-ck-text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="hidden overflow-x-auto rounded-[var(--ck-radius-card)] border border-ck-border md:block">
        <table className="min-w-full divide-y divide-ck-border text-sm">
          <thead className="bg-ck-surface-muted/60">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-left font-semibold uppercase tracking-[0.08em] text-ck-text-muted",
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ck-border bg-ck-surface">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-ck-surface-muted/40">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3 align-top", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <Card key={rowKey(row)} variant="outlined" className="space-y-2 p-4">
            {mobileCard ? mobileCard(row) : columns.map((column) => (
              <div key={column.key} className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
                  {column.header}
                </span>
                <div className="text-sm text-ck-text">{column.cell(row)}</div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminTableLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="font-medium text-ck-yellow hover:underline">
      {children}
    </Link>
  );
}
