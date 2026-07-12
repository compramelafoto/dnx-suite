import { EDITORIAL_STATUS_LABELS, type EditorialStatus } from "@/lib/editorial";

const styles: Record<EditorialStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-800",
  IN_REVIEW: "bg-[var(--is-orange-50)] text-[var(--is-orange-800)]",
  READY_TO_PUBLISH: "bg-sky-100 text-sky-900",
  PUBLISHED: "bg-teal-100 text-teal-800",
  UNPUBLISHED: "bg-amber-100 text-amber-900",
  ARCHIVED: "bg-stone-200 text-stone-700",
};

type Props = {
  status: string;
  pendingReturn?: boolean;
  /** Labels de producto (artículo femenino / evento neutro). */
  labels?: Record<EditorialStatus, string>;
  pendingReturnLabel?: string;
};

export function StatusBadge({
  status,
  pendingReturn,
  labels = EDITORIAL_STATUS_LABELS,
  pendingReturnLabel = "Devuelto",
}: Props) {
  const key = (labels[status as EditorialStatus] ? status : "DRAFT") as EditorialStatus;
  const label = pendingReturn ? pendingReturnLabel : labels[key];
  const className = pendingReturn ? "bg-amber-100 text-amber-950" : styles[key];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <span className="sr-only">Estado:</span>
      {label}
    </span>
  );
}
