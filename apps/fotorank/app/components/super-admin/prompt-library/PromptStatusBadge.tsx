import type { PhotoPromptStatus } from "@repo/photo-prompt-library";
import { STATUS_LABELS } from "./labels";

const TONE: Record<PhotoPromptStatus, string> = {
  DRAFT: "border-fr-border bg-fr-bg-elevated text-fr-muted",
  IN_REVIEW: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  APPROVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100",
  REJECTED: "border-red-500/40 bg-red-500/10 text-red-100",
  ARCHIVED: "border-fr-border bg-fr-card text-fr-muted",
};

export function PromptStatusBadge({ status }: { status: PhotoPromptStatus }) {
  return (
    <span
      className={`inline-flex rounded border px-2.5 py-1 text-xs font-medium ${TONE[status]}`}
      data-testid={`prompt-status-${status}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
