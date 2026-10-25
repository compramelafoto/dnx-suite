import { getParticipantCardsKeyPrefix } from "./participant-card-feature-flags";
import type { ClickatonParticipantCardType } from "./participant-card-types";

function sanitizeSegment(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

/** Prefijo de key R2. Staging: `clickaton-staging/participant-cards`. Default: `clickaton/participant-cards`. */
export function getParticipantCardKeyPrefix(): string {
  return getParticipantCardsKeyPrefix();
}

const CARD_SEGMENT_BY_TYPE: Record<string, string> = {
  WELCOME: "welcome",
  MEMBER: "member",
  DIPLOMA: "diploma",
};

function resolveCardSegment(cardType: string): string {
  const segment = CARD_SEGMENT_BY_TYPE[cardType.toUpperCase()];
  if (!segment) throw new Error(`UNKNOWN_CARD_TYPE: ${cardType}`);
  return segment;
}

export function buildParticipantCardStorageKey(input: {
  editionId: string;
  registrationId: string;
  cardType: ClickatonParticipantCardType | "WELCOME" | "MEMBER" | "DIPLOMA";
  templateVersion: number;
  renderHash: string;
  /** `png` por defecto; `pdf` para el diploma imprimible. */
  extension?: "png" | "pdf";
}): string {
  const cardSegment = resolveCardSegment(String(input.cardType));
  const edition = sanitizeSegment(input.editionId);
  const registration = sanitizeSegment(input.registrationId);
  const version = Math.max(1, Math.floor(input.templateVersion));
  const hash = sanitizeSegment(input.renderHash);
  const prefix = getParticipantCardKeyPrefix();
  const ext = input.extension ?? "png";
  return `${prefix}/edition-${edition}/registration-${registration}/${cardSegment}/v${version}/${hash}.${ext}`;
}
