"use client";

import { formatContestStatus } from "../../../lib/fotorank/contestStatus";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-[#262626] text-fr-muted border border-[#333]",
  SETUP_IN_PROGRESS: "bg-gold/10 text-gold border border-gold/30",
  READY_TO_PUBLISH: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
  PUBLISHED: "bg-gold/20 text-gold border border-gold/40",
  CLOSED: "bg-[#262626] text-fr-muted border border-[#333]",
  ARCHIVED: "bg-[#1a1a1a] text-fr-muted-soft border border-[#262626]",
  ACTIVE: "bg-gold/20 text-gold border border-gold/40", // Legacy
};

interface ContestStatusBadgeProps {
  status: string;
  className?: string;
}

export function ContestStatusBadge({ status, className = "" }: ContestStatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${style} ${className}`}
    >
      {formatContestStatus(status)}
    </span>
  );
}
