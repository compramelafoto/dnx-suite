import "server-only";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { normalizarSitioWeb, normalizarUsuarioRed, urlDeUsuario } from "@/lib/membership/social";
import { partnersReader } from "./clients";
import { SPONSORS_MODULE_KEY, type SponsorPlacementKey } from "./constants";
import { logoDe } from "./repository";

/**
 * Lo que hoy ocupa un espacio de sponsors de una institución, listo para dibujar.
 *
 * Nunca lanza: si DNX Partners no responde o el módulo está apagado, el espacio sale vacío y
 * la página sigue. Un sponsor caído no puede dejar sin portada a la institución.
 */

export type PlacedSponsor = {
  partnerId: string;
  name: string;
  logoSrc: string | null;
  /** El enlace de la institución si lo cargó; si no, la web o el Instagram del sponsor. */
  href: string | null;
  title: string | null;
  description: string | null;
};

function enlaceDe(p: { destinationUrl: string | null; websiteUrl: string | null; instagram: string | null }) {
  for (const candidato of [p.destinationUrl, p.websiteUrl]) {
    const r = normalizarSitioWeb(candidato);
    if (r.ok && r.valor) return r.valor;
  }
  const ig = normalizarUsuarioRed("instagram", p.instagram);
  return ig.ok && ig.valor ? urlDeUsuario("instagram", ig.valor) : null;
}

export async function loadActivePlacement(
  workspaceId: string,
  placementKey: SponsorPlacementKey,
  ahora = new Date(),
): Promise<PlacedSponsor[]> {
  try {
    if (!(await isModuleEnabledForWorkspace(workspaceId, SPONSORS_MODULE_KEY))) return [];
    const db = await partnersReader();
    const filas = await db.dnxPartnerInventoryBooking.findMany({
      where: {
        placementKey,
        contextType: "ORGANIZATION",
        contextId: workspaceId,
        status: "SOLD",
        startsAt: { lte: ahora },
        endsAt: { gt: ahora },
        partner: { archivedAt: null },
      },
      orderBy: [{ slotIndex: "asc" }, { createdAt: "asc" }],
      select: {
        partner: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            websiteUrl: true,
            instagram: true,
            brandAssets: {
              where: { archivedAt: null, status: "ACTIVE", approvalStatus: "APPROVED" },
              orderBy: { createdAt: "desc" },
            },
            participations: {
              where: {
                application: "FOTO_OFFICE",
                contextType: "ORGANIZATION",
                contextId: workspaceId,
                archivedAt: null,
                status: { notIn: ["ARCHIVED", "CANCELLED"] },
              },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { title: true, description: true, destinationUrl: true },
            },
          },
        },
      },
    });

    const vistos = new Set<string>();
    const resultado: PlacedSponsor[] = [];
    for (const { partner } of filas) {
      const vinculo = partner.participations[0];
      // Desvinculado: sus espacios se cancelan al desvincular, pero por las dudas no se muestra.
      if (!vinculo || vistos.has(partner.id)) continue;
      vistos.add(partner.id);
      resultado.push({
        partnerId: partner.id,
        name: partner.name,
        logoSrc: logoDe(partner),
        href: enlaceDe({ ...vinculo, websiteUrl: partner.websiteUrl, instagram: partner.instagram }),
        title: vinculo.title,
        description: vinculo.description,
      });
    }
    return resultado;
  } catch (error) {
    console.error("[fotoffice][sponsors] no se pudo leer el espacio", {
      placementKey,
      detalle: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
