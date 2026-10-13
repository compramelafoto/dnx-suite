import "server-only";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { partnersReader } from "./clients";
import { SPONSORS_MODULE_KEY } from "./constants";
import { compararPorMarca, tieneBeneficio } from "./benefits";
import { enlaceDe, type PlacedSponsor } from "./placements";
import { logoDe } from "./repository";

/**
 * Los beneficios vigentes de una institución, para la sección «Beneficios» del portal.
 *
 * Mismo contrato que los espacios de sponsors (`placements.ts`): nunca lanza y tiene tope de
 * espera. Si DNX Partners no responde, la pantalla dice que no pudo leerlos en vez de caerse.
 */

const ESPERA_MAXIMA_MS = 2500;

export type BenefitsResult = { ok: true; items: PlacedSponsor[] } | { ok: false };

export async function loadPortalBenefits(workspaceId: string): Promise<BenefitsResult> {
  let corte: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<BenefitsResult>((resolve) => {
    corte = setTimeout(() => {
      console.error("[fotoffice][beneficios] la lectura tardó demasiado");
      resolve({ ok: false });
    }, ESPERA_MAXIMA_MS);
  });
  try {
    return await Promise.race([leer(workspaceId), tope]);
  } finally {
    clearTimeout(corte);
  }
}

async function leer(workspaceId: string): Promise<BenefitsResult> {
  try {
    if (!(await isModuleEnabledForWorkspace(workspaceId, SPONSORS_MODULE_KEY))) return { ok: true, items: [] };
    const db = await partnersReader();
    const filas = await db.dnxPartnerParticipation.findMany({
      where: {
        application: "FOTO_OFFICE",
        contextType: "ORGANIZATION",
        contextId: workspaceId,
        archivedAt: null,
        status: { notIn: ["ARCHIVED", "CANCELLED"] },
        partner: { archivedAt: null },
      },
      orderBy: { createdAt: "asc" },
      select: {
        title: true,
        description: true,
        destinationUrl: true,
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
          },
        },
      },
    });

    const vistos = new Set<string>();
    const items: PlacedSponsor[] = [];
    for (const fila of filas) {
      if (!tieneBeneficio(fila) || vistos.has(fila.partner.id)) continue;
      vistos.add(fila.partner.id);
      items.push({
        partnerId: fila.partner.id,
        name: fila.partner.name,
        logoSrc: logoDe(fila.partner),
        href: enlaceDe({ ...fila, websiteUrl: fila.partner.websiteUrl, instagram: fila.partner.instagram }),
        title: fila.title?.trim() || null,
        description: fila.description?.trim() || null,
      });
    }
    return { ok: true, items: items.sort(compararPorMarca) };
  } catch (error) {
    console.error("[fotoffice][beneficios] no se pudieron leer", {
      detalle: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}
