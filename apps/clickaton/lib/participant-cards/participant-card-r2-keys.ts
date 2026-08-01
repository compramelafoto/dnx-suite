import type { ClickatonParticipantCardType } from "./participant-card-types";

function sanitizeSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "x";
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
  return `clickaton/participant-cards/edition-${edition}/registration-${registration}/${cardSegment}/v${version}/${hash}.png`;
}
