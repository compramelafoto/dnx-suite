/**
 * Discriminador de tipo de experiencia pública (Etapa 09A).
 * Independiente de distributionChannel, visibility y modalidad (individual/grupal).
 *
 * Clickatón oficial = MARATHON + CLICKATON (ambos requeridos).
 */

export const FOTORANK_PUBLIC_EXPERIENCE_TYPES = ["contest", "marathon"] as const;

export type FotorankPublicExperienceTypeV1 =
  (typeof FOTORANK_PUBLIC_EXPERIENCE_TYPES)[number];

export type InternalExperienceType = "CONTEST" | "MARATHON";

export function mapInternalExperienceTypeToPublic(
  experienceType: InternalExperienceType | undefined | null,
): FotorankPublicExperienceTypeV1 {
  if (experienceType === "MARATHON") return "marathon";
  return "contest";
}

/**
 * ¿Puede publicarse como maratón oficial Clickatón?
 * Requiere ambos discriminadores. Canal solo no alcanza.
 */
export function isOfficialClickatonMarathon(input: {
  experienceType: FotorankPublicExperienceTypeV1 | InternalExperienceType | null | undefined;
  distributionChannel:
    | "clickaton"
    | "fotorank"
    | "CLICKATON"
    | "FOTORANK"
    | null
    | undefined;
}): boolean {
  const experience =
    input.experienceType === "MARATHON" || input.experienceType === "marathon";
  const channel =
    input.distributionChannel === "CLICKATON" ||
    input.distributionChannel === "clickaton";
  return experience && channel;
}

/**
 * CONTEST + CLICKATON es incoherente: no es maratón oficial y no debe persistirse.
 */
export function isIncoherentExperienceChannelCombo(input: {
  experienceType: InternalExperienceType;
  distributionChannel: "FOTORANK" | "CLICKATON" | null;
}): boolean {
  return (
    input.experienceType === "CONTEST" &&
    input.distributionChannel === "CLICKATON"
  );
}

export function incoherentExperienceChannelMessage(): string {
  return "Clickatón solo admite eventos con tipo de experiencia Maratón. Un concurso tradicional no puede publicarse en el canal Clickatón.";
}
