import { prisma } from "@/lib/prisma";

/**
 * Modo de publicación de una agencia (spec, "Encaje con el filtrado"): IMMEDIATE publica al procesar; AWAIT_FILTER
 * deja el trabajo de ingesta en AWAITING_FILTER hasta la señal del filtro de la nube. En la etapa 3a se cambia
 * sólo por SQL (no hay selector) porque el filtro todavía no existe.
 */
export const AGENCY_PUBLISH_MODES = ["IMMEDIATE", "AWAIT_FILTER"] as const;
export type AgencyPublishMode = (typeof AGENCY_PUBLISH_MODES)[number];

export function awaitsFilter(mode: string | null | undefined): boolean {
  return mode === "AWAIT_FILTER";
}

export async function agencyAwaitsFilter(agencyId: number): Promise<boolean> {
  const a = await prisma.agency.findUnique({ where: { id: agencyId }, select: { publishMode: true } });
  return awaitsFilter(a?.publishMode);
}
