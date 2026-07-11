import { STATUS_LABELS, type ArticleStatus } from "@/lib/article-status";

const styles: Record<ArticleStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PUBLISHED: "bg-teal-100 text-teal-800",
  UNPUBLISHED: "bg-amber-100 text-amber-900",
  ARCHIVED: "bg-stone-200 text-stone-700",
};

export function StatusBadge({ status }: { status: string }) {
  const key = (STATUS_LABELS[status as ArticleStatus] ? status : "DRAFT") as ArticleStatus;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[key]}`}>
      {STATUS_LABELS[key]}
    </span>
  );
}
