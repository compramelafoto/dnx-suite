/**
 * Mapa comercial del inventario publicitario.
 *
 * `campaigns.ts` dice cómo se dibuja cada espacio. Este archivo dice quién puede
 * venderlo, quién lo ve, si el código lo renderiza hoy y si se paga o se canjea.
 *
 * No copia la lista de espacios: la deriva de `AD_PLACEMENT_CATALOG`. La tabla de
 * abajo está tipada como `Record<DnxPartnerAdPlacementKey, …>`, así que agregar un
 * espacio al catálogo sin decidir quién lo vende no compila.
 */
import {
  AD_PLACEMENT_CATALOG,
  type AdPlacementCatalogEntry,
  type DnxPartnerAdPlacementKey,
} from "./campaigns";
import type { DnxPartnerApplication, DnxPartnerAudienceType } from "./types";

/** Quién tiene derecho a vender un espacio. */
export const DNX_INVENTORY_OWNERS = ["PLATFORM", "ORGANIZER", "WORKSPACE"] as const;
export type DnxInventoryOwner = (typeof DNX_INVENTORY_OWNERS)[number];

/**
 * Cómo accede un partner al espacio.
 * `SALE`: paga. `EXCHANGE`: da beneficios a los socios en vez de plata.
 * `BOTH`: admite cualquiera de las dos.
 */
export const DNX_INVENTORY_ACCESS_MODES = ["SALE", "EXCHANGE", "BOTH"] as const;
export type DnxInventoryAccess = (typeof DNX_INVENTORY_ACCESS_MODES)[number];

type CommercialRow = {
  owner: DnxInventoryOwner;
  audience: DnxPartnerAudienceType;
  /** true solo si hay código que lo renderiza hoy. Auditado el 2026-08-27. */
  mounted: boolean;
  access: DnxInventoryAccess;
};

const PLATFORM_PUBLIC: CommercialRow = {
  owner: "PLATFORM",
  audience: "ALL_USERS",
  mounted: true,
  access: "SALE",
};

const COMMERCIAL_ROWS: Record<DnxPartnerAdPlacementKey, CommercialRow> = {
  // InfoSpot — es un medio: todo es de la plataforma.
  INFOSPOT_HOME_WELCOME: PLATFORM_PUBLIC,
  INFOSPOT_HOME_TOP: PLATFORM_PUBLIC,
  INFOSPOT_HOME_INLINE: PLATFORM_PUBLIC,
  INFOSPOT_HOME_MARQUEE: PLATFORM_PUBLIC,
  INFOSPOT_ARTICLE_TOP: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_ARTICLE_INLINE: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_ARTICLE_BOTTOM: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_GALLERY_INLINE: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_FLOATING: { ...PLATFORM_PUBLIC, mounted: false },
  INFOSPOT_EVENT_PAGE: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },

  // Clickatón — el equipo organiza sus propias maratones.
  CLICKATON_HOME_WELCOME: PLATFORM_PUBLIC,
  CLICKATON_EVENT_WELCOME: { ...PLATFORM_PUBLIC, audience: "EVENT_PARTICIPANTS" },
  CLICKATON_HOME_MARQUEE: { ...PLATFORM_PUBLIC, mounted: false },

  // FotoRank — la portada es de la plataforma; el concurso, del organizador.
  FOTORANK_HOME_WELCOME: PLATFORM_PUBLIC,
  FOTORANK_CONTEST_WELCOME: {
    owner: "ORGANIZER",
    audience: "EVENT_PARTICIPANTS",
    mounted: true,
    access: "SALE",
  },

  // ComprameLaFoto — hoy no hay vendedor intermedio.
  CLF_HOME_WELCOME: PLATFORM_PUBLIC,
  CLF_HOME_PROMO: PLATFORM_PUBLIC,
  CLF_LOGO_MARQUEE: PLATFORM_PUBLIC,
  CLF_ALBUM_WELCOME: { ...PLATFORM_PUBLIC, audience: "EVENT_PARTICIPANTS" },
  CLF_GALLERY_TOP: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_GALLERY_INLINE: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_PHOTO_DETAIL_BELOW: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_EVENT_PAGE: {
    ...PLATFORM_PUBLIC,
    audience: "EVENT_PARTICIPANTS",
    mounted: false,
  },
  CLF_CHECKOUT_SUPPORTING: {
    ...PLATFORM_PUBLIC,
    audience: "PRODUCT_PURCHASERS",
    mounted: false,
  },

  // FotoOffice — la institución consigue sus propios sponsors. Nada montado.
  FOTOFFICE_PORTAL_WELCOME: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "BOTH",
  },
  FOTOFFICE_PORTAL_SPONSORS: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "BOTH",
  },
  FOTOFFICE_PORTAL_MARQUEE: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "EXCHANGE",
  },
  FOTOFFICE_BENEFIT_CARD: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "EXCHANGE",
  },
  FOTOFFICE_RAFFLE_SPONSOR: {
    owner: "WORKSPACE",
    audience: "MEMBERSHIP_HOLDERS",
    mounted: false,
    access: "BOTH",
  },
  FOTOFFICE_PUBLIC_MARQUEE: {
    owner: "WORKSPACE",
    audience: "ALL_USERS",
    mounted: false,
    access: "SALE",
  },
};

export type DnxInventorySpace = AdPlacementCatalogEntry & CommercialRow;

/** Orden estable: por aplicación y después por clave. */
export const DNX_INVENTORY: readonly DnxInventorySpace[] = AD_PLACEMENT_CATALOG.map(
  (entry) => ({ ...entry, ...COMMERCIAL_ROWS[entry.placementKey] }),
).sort((a, b) => {
  // Comparación cruda, no `localeCompare`: el orden tiene que ser idéntico al de
  // `Array.prototype.sort` por defecto, que es contra lo que compara la prueba.
  const ka = `${a.application}|${a.placementKey}`;
  const kb = `${b.application}|${b.placementKey}`;
  if (ka < kb) return -1;
  if (ka > kb) return 1;
  return 0;
});

export type SellerScope = {
  owner: DnxInventoryOwner;
  /** Limita a una aplicación. Sin esto, devuelve todas las del dueño. */
  application?: DnxPartnerApplication;
  /** Vía de acceso buscada. Los espacios `BOTH` entran siempre. */
  access?: DnxInventoryAccess;
  /** Incluir lo declarado pero todavía no montado. Por defecto, no. */
  includeUnmounted?: boolean;
};

/**
 * Los espacios que ese vendedor puede ofrecer.
 *
 * Sin `includeUnmounted`, lo no montado queda afuera: es lo que impide
 * prometerle a una marca un lugar donde su logo nunca aparecería.
 */
export function listSellableSpaces(seller: SellerScope): readonly DnxInventorySpace[] {
  return DNX_INVENTORY.filter((space) => {
    if (space.owner !== seller.owner) return false;
    if (seller.application && space.application !== seller.application) return false;
    if (!seller.includeUnmounted && !space.mounted) return false;
    if (seller.access && seller.access !== "BOTH") {
      if (space.access !== seller.access && space.access !== "BOTH") return false;
    }
    return true;
  });
}
