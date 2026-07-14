import { Badge } from "@/components/ui/Badge";
import {
  marathonStatusLabels,
  registrationStatusLabels,
  type MarathonStatus,
  type RegistrationStatus,
} from "@/types/marathon";

const marathonVariant: Partial<Record<MarathonStatus, "brand" | "neutral" | "accent" | "warning" | "danger" | "success">> = {
  announced: "brand",
  registration_open: "success",
  registration_closed: "neutral",
  in_progress: "accent",
  judging: "warning",
  results_published: "success",
  cancelled: "danger",
  draft: "neutral",
  archived: "neutral",
};

const registrationVariant: Partial<
  Record<RegistrationStatus, "brand" | "neutral" | "accent" | "warning" | "danger" | "success">
> = {
  coming_soon: "warning",
  open: "success",
  last_places: "accent",
  full: "neutral",
  closed: "neutral",
  unavailable: "neutral",
  cancelled: "danger",
};

type MarathonStatusBadgesProps = {
  status: MarathonStatus;
  registrationStatus: RegistrationStatus;
};

export function MarathonStatusBadges({
  status,
  registrationStatus,
}: MarathonStatusBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={marathonVariant[status] ?? "neutral"}>
        {marathonStatusLabels[status]}
      </Badge>
      <Badge variant={registrationVariant[registrationStatus] ?? "neutral"}>
        Inscripción: {registrationStatusLabels[registrationStatus]}
      </Badge>
    </div>
  );
}
