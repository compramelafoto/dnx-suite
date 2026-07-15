/**
 * Discriminador de canal/marca de publicación (Etapa 08C).
 * Independiente de visibility (PUBLIC / UNLISTED / PRIVATE) y de experienceType.
 *
 * Singular: cada evento pertenece a un único canal de distribución.
 * NULL interno / ausente = portal general FotoRank (no Clickatón).
 *
 * Clickatón oficial = experienceType MARATHON + canal CLICKATON (ver experience.ts).
 */

export const FOTORANK_PUBLIC_DISTRIBUTION_CHANNELS = [
  "fotorank",
  "clickaton",
] as const;

export type FotorankPublicDistributionChannelV1 =
  (typeof FOTORANK_PUBLIC_DISTRIBUTION_CHANNELS)[number];

export type InternalDistributionChannel = "FOTORANK" | "CLICKATON" | null;

export function mapInternalDistributionChannelToPublic(
  channel: InternalDistributionChannel | undefined,
): FotorankPublicDistributionChannelV1 | null {
  if (channel === "CLICKATON") return "clickaton";
  if (channel === "FOTORANK") return "fotorank";
  return null;
}

/**
 * Parsea `?channel=` de query pública.
 * Retorna undefined si no se envió; null si valor inválido.
 */
export function parsePublicChannelQueryParam(
  value: string | null | undefined,
): FotorankPublicDistributionChannelV1 | undefined | null {
  if (value == null || value.trim() === "") return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    (FOTORANK_PUBLIC_DISTRIBUTION_CHANNELS as readonly string[]).includes(
      normalized,
    )
  ) {
    return normalized as FotorankPublicDistributionChannelV1;
  }
  return null;
}

/**
 * Filtro Prisma para listado/detalle cuando el cliente pide un canal.
 * - clickaton → solo CLICKATON + MARATHON (regla oficial Clickatón)
 * - fotorank → FOTORANK o NULL (portal general); cualquier experienceType
 */
export function distributionChannelWhereForPublicFilter(
  channel: FotorankPublicDistributionChannelV1,
):
  | { distributionChannel: "CLICKATON"; experienceType: "MARATHON" }
  | { OR: Array<{ distributionChannel: "FOTORANK" | null }> } {
  if (channel === "clickaton") {
    return {
      distributionChannel: "CLICKATON",
      experienceType: "MARATHON",
    };
  }
  return {
    OR: [{ distributionChannel: "FOTORANK" }, { distributionChannel: null }],
  };
}

/** Defensa: ¿el evento pertenece al canal solicitado? */
export function eventMatchesPublicChannel(
  eventChannel: FotorankPublicDistributionChannelV1 | null | undefined,
  requested: FotorankPublicDistributionChannelV1,
  experienceType?: "contest" | "marathon" | null,
): boolean {
  if (requested === "clickaton") {
    return (
      eventChannel === "clickaton" &&
      (experienceType == null || experienceType === "marathon")
    );
  }
  // fotorank: explícito o sin canal
  return eventChannel === "fotorank" || eventChannel == null;
}
