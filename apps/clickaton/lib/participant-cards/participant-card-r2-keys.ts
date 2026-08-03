import { getParticipantCardsKeyPrefix } from "./participant-card-feature-flags";
import type { ClickatonParticipantCardType } from "./participant-card-types";

function sanitizeSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

/** Prefijo de key R2. Staging: `clickaton-staging/participant-cards`. Default: `clickaton/participant-cards`. */
export function getParticipantCardKeyPrefix(): string {
  return getParticipantCardsKeyPrefix();
}

export function buildParticipantCardStorageKey(input: {
  editionId: string;
  registrationId: string;
  cardType: ClickatonParticipantCardType | "WELCOME" | "MEMBER";
  templateVersion: number;
  renderHash: string;
}): string {
  const cardSegment =
    String(input.cardType).toUpperCase() === "MEMBER" ||
    String(input.cardType).toLowerCase() === "member"
      ? "member"
      : "welcome";
  const edition = sanitizeSegment(input.editionId);
  const registration = sanitizeSegment(input.registrationId);
  const version = Math.max(1, Math.floor(input.templateVersion));
  const hash = sanitizeSegment(input.renderHash);
  const prefix = getParticipantCardKeyPrefix();
  return `${prefix}/edition-${edition}/registration-${registration}/${cardSegment}/v${version}/${hash}.png`;
}
