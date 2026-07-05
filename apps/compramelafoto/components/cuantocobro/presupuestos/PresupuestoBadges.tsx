import type { CuantoCobroQuoteStatus } from "@prisma/client";
import { formatQuoteStatus } from "@/lib/cuantocobro/quote/quote-format";

type Props = {
  status: CuantoCobroQuoteStatus;
  archivedAt: string | null;
};

function badgeClass(status: CuantoCobroQuoteStatus, archived: boolean): string {
  if (archived) return "cc-presupuesto-badge--archived";
  switch (status) {
    case "DRAFT":
      return "cc-presupuesto-badge--draft";
    case "SENT":
      return "cc-presupuesto-badge--sent";
    case "VIEWED":
      return "cc-presupuesto-badge--viewed";
    case "ACCEPTED":
      return "cc-presupuesto-badge--accepted";
    case "REJECTED":
      return "cc-presupuesto-badge--rejected";
    default:
      return "cc-presupuesto-badge--draft";
  }
}

export default function PresupuestoStatusBadge({ status, archivedAt }: Props) {
  const archived = Boolean(archivedAt);
  return (
    <span className={`cc-presupuesto-badge ${badgeClass(status, archived)}`}>
      {formatQuoteStatus(status, archivedAt)}
    </span>
  );
}
