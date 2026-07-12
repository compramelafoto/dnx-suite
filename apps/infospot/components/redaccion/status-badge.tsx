import { STATUS_LABELS, type ArticleStatus } from "@/lib/article-status";

const styles: Record<ArticleStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-800",
  IN_REVIEW: "bg-[var(--is-orange-50)] text-[var(--is-orange-800)]",
  READY_TO_PUBLISH: "bg-sky-100 text-sky-900",
  PUBLISHED: "bg-teal-100 text-teal-800",
  UNPUBLISHED: "bg-amber-100 text-amber-900",
  ARCHIVED: "bg-stone-200 text-stone-700",
};

export function StatusBadge({
  status,
  pendingReturn,
}: {
  status: string;
  pendingReturn?: boolean;
}) {
  const key = (STATUS_LABELS[status as ArticleStatus] ? status : "DRAFT") as ArticleStatus;
  const label = pendingReturn ? "Devuelta" : STATUS_LABELS[key];
  const className = pendingReturn
    ? "bg-amber-100 text-amber-950"
    : styles[key];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <span className="sr-only">Estado:</span>
      {label}
    </span>
  );
}
