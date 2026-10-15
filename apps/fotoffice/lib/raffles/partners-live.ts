import "server-only";
import { prisma } from "@repo/db";
import { resolveSponsorCardLogoCandidates, type PartnerBrandAssetRecord } from "@repo/partners";
import { normalizarSitioWeb, normalizarUsuarioRed, urlDeUsuario } from "@/lib/membership/social";

/**
 * Lo que el socio ve de cada marca que dona un premio, leído en vivo de DNX Partners.
 *
 * ── Por qué en vivo y no la instantánea del premio ──
 *
 * El premio guarda una copia del logo y el nombre para que la constancia de un sorteo viejo no
 * cambie. Pero la ficha que el socio mira antes del sorteo es publicidad del aliado: si el
 * aliado cambia su logo o su Instagram, lo que corresponde es mostrar el actual. La copia queda
 * como respaldo cuando DNX Partners no responde.
 *
 * Las fichas viven en la base de Clickatón (ahí está el panel de Partners), así que se leen con
 * el cliente de sólo lectura, igual que el buscador del formulario de premios.
 */

export type PartnerCard = {
  id: string;
  name: string;
  /** Ruta propia que entrega el logo, o una dirección absoluta si sólo hay `logoUrl`. */
  logoSrc: string | null;
  instagramUrl: string | null;
  websiteUrl: string | null;
};

/** Ruta de FOTOFFICE que entrega el logo de un aliado. Ver `app/api/sorteos/logo/[assetId]`. */
export function partnerLogoRoute(assetId: string): string {
  return `/api/sorteos/logo/${assetId}`;
}

const SELECT = {
  id: true,
  name: true,
  logoUrl: true,
  instagram: true,
  websiteUrl: true,
  brandAssets: {
    where: { archivedAt: null, status: "ACTIVE" as const, approvalStatus: "APPROVED" as const },
  },
};

type FilaPartner = {
  id: string;
  name: string;
  logoUrl: string | null;
  instagram: string | null;
  websiteUrl: string | null;
  brandAssets: unknown[];
};

async function leerPartners(ids: string[]): Promise<FilaPartner[]> {
  const consulta = { where: { id: { in: ids } }, select: SELECT };
  const { getClickatonReadonlyClient, isClickatonReadonlyAvailable } = await import(
    "@repo/db/clickaton-readonly-client"
  );
  if (isClickatonReadonlyAvailable()) {
    try {
      return await getClickatonReadonlyClient().dnxPartner.findMany(consulta);
    } catch (error) {
      console.error("[fotoffice][sorteos] no se pudo leer los aliados de Partners", {
        detalle: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
  return prisma.dnxPartner.findMany(consulta);
}

/** Elige el logo pensado para fondo claro: las fichas de premio son blancas. */
export function elegirLogo(partner: Pick<FilaPartner, "logoUrl" | "brandAssets">): string | null {
  const candidatos = resolveSponsorCardLogoCandidates({
    assets: partner.brandAssets as PartnerBrandAssetRecord[],
    logoUrl: partner.logoUrl,
  });
  for (const c of candidatos) {
    if (c.assetId) return partnerLogoRoute(c.assetId);
    if (/^https:\/\//i.test(c.url)) return c.url;
  }
  return null;
}

function instagramDe(valor: string | null): string | null {
  const r = normalizarUsuarioRed("instagram", valor);
  return r.ok && r.valor ? urlDeUsuario("instagram", r.valor) : null;
}

function sitioDe(valor: string | null): string | null {
  const r = normalizarSitioWeb(valor);
  return r.ok && r.valor ? r.valor : null;
}

/**
 * Las fichas de los aliados pedidos, por id. Si DNX Partners no responde devuelve un mapa vacío
 * y cada premio se muestra con su instantánea: un sorteo no puede dejar de verse por esto.
 */
export async function loadPartnerCards(ids: Iterable<string | null>): Promise<Map<string, PartnerCard>> {
  const unicos = [...new Set([...ids].filter((id): id is string => Boolean(id)))];
  const mapa = new Map<string, PartnerCard>();
  if (unicos.length === 0) return mapa;

  for (const p of await leerPartners(unicos)) {
    mapa.set(p.id, {
      id: p.id,
      name: p.name,
      logoSrc: elegirLogo(p),
      instagramUrl: instagramDe(p.instagram),
      websiteUrl: sitioDe(p.websiteUrl),
    });
  }
  return mapa;
}
