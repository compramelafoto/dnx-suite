import type { ParticipantStatusPresentation } from "../../lib/fotorank/participant-experience";

type Props = {
  status: ParticipantStatusPresentation;
};

export function ParticipantStatusPill({ status }: Props) {
  const Icon = status.icon;
  return (
    <span className={`fr-participant-status-pill fr-participant-status-pill--${status.tone}`}>
      <Icon width={14} height={14} strokeWidth={2} aria-hidden />
      <span>{status.label}</span>
    </span>
  );
}
