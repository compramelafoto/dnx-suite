import { Badge } from "@/components/ui/Badge";
import {
  EDITION_STATUS_LABELS,
  type ClickatonEditionStatus,
} from "@/lib/admin/editions/types";

const STATUS_VARIANT: Record<
  ClickatonEditionStatus,
  "neutral" | "brand" | "success" | "warning" | "danger" | "accent"
> = {
  DRAFT: "neutral",
  REGISTRATION_OPEN: "success",
  REGISTRATION_CLOSED: "warning",
  IN_PROGRESS: "brand",
  COMPLETED: "accent",
  REPROGRAMMED: "warning",
  CANCELLED: "danger",
};

type Props = {
  status: ClickatonEditionStatus;
  published?: boolean;
  active?: boolean;
  kind?: "edition" | "venue";
};

export function AdminStatusBadge({ status, published, active, kind = "edition" }: Props) {
  if (kind === "venue") {
    return (
      <Badge variant={active ? "success" : "neutral"}>
        {active ? "Activa" : "Inactiva"}
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={STATUS_VARIANT[status]}>{EDITION_STATUS_LABELS[status]}</Badge>
      {published ? <Badge variant="brand">Publicada</Badge> : null}
      {published === false ? <Badge variant="neutral">No publicada</Badge> : null}
    </div>
  );
}
