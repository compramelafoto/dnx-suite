/**
 * Clickatón AR 2026 — IMP02 partners catalog (operator lists A/B).
 * Source data for `seed-clickaton-partners-imp02.mts`.
 * No logos invented; publicVisibility stays HIDDEN until ops publish.
 */

export type Imp02LookupKeys = {
  slug: string;
  name: string;
  legalName?: string | null;
  instagram?: string | null;
  websiteUrl?: string | null;
  email?: string | null;
};

export type Imp02ContributionSpec = {
  type:
    | "VOUCHER"
    | "PRODUCT"
    | "PRIZE"
    | "DISCOUNT"
    | "SERVICE"
    | "VENUE"
    | "OTHER"
    | "INSTITUTIONAL_SUPPORT"
    | "CONTENT";
  title: string;
  description?: string | null;
  quantity?: number | null;
  status: "PENDING" | "CONFIRMED";
  notes?: string | null;
};

export type Imp02CatalogEntry = {
  key: string;
  list: "CONFIRMED" | "PROSPECT";
  partner: {
    name: string;
    legalName?: string | null;
    slug: string;
    type:
      | "COMPANY"
      | "BUSINESS"
      | "BRAND"
      | "INSTITUTION"
      | "ORGANIZATION"
      | "PERSON"
      | "GOVERNMENT"
      | "OTHER";
    status: "ACTIVE" | "PROSPECT";
    websiteUrl?: string | null;
    instagram?: string | null;
    email?: string | null;
    phone?: string | null;
    description?: string | null;
    notes: string;
  };
  /** Only for CONFIRMED list */
  participation?: {
    institutionalRole:
      | "COLLABORATOR"
      | "SPONSOR"
      | "STRATEGIC_PARTNER"
      | "MEDIA_PARTNER"
      | "INSTITUTIONAL_SPONSOR";
    displayTier?: "STANDARD" | "SUPPORTING" | "MAIN" | "INSTITUTIONAL";
    status: "CONFIRMED";
    publicVisibility: "HIDDEN";
    requiresPayment: false;
    title?: string | null;
    notes: string;
    roleDecisionPending?: boolean;
  };
  contributions?: Imp02ContributionSpec[];
  humanReviewFlags?: string[];
};

/** Lowercase, trim, collapse spaces, strip accents — for soft dedup. */
export function normalizeLookupName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export const CLICKATON_PARTNERS_IMP02_CATALOG: Imp02CatalogEntry[] = [
  // ─── LIST A — CONFIRMED ─────────────────────────────────────────────
  {
    key: "venite-con-tiempo",
    list: "CONFIRMED",
    partner: {
      name: "Venite con Tiempo",
      slug: "venite-con-tiempo",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador confirmado. Coordinar entrega de vouchers.",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador confirmado. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "VOUCHER",
        title: "2 vouchers de compra",
        quantity: 2,
        status: "CONFIRMED",
        notes: "Coordinar entrega",
      },
    ],
  },
  {
    key: "sliders",
    list: "CONFIRMED",
    partner: {
      name: "Sliders",
      slug: "sliders",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador confirmado (combos Sampler).",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador confirmado. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "PRODUCT",
        title: "3 combos Sampler",
        quantity: 3,
        status: "CONFIRMED",
      },
    ],
  },
  {
    key: "choco-y-arte",
    list: "CONFIRMED",
    partner: {
      name: "Choco & Arte",
      slug: "choco-y-arte",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador. Cantidad de cajas depende de ganadores (qty unknown).",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador. Aporte de chocolates pendiente de cantidad por ganador.",
    },
    contributions: [
      {
        type: "PRODUCT",
        title: "1 caja de chocolates por cada ganador",
        quantity: null,
        status: "PENDING",
        notes: "Cantidad desconocida: 1 caja por cada ganador",
      },
    ],
  },
  {
    key: "multi-shop",
    list: "CONFIRMED",
    partner: {
      name: "Multi Shop",
      slug: "multi-shop",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador. Aporte compuesto (aguas + barritas).",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador confirmado. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "PRODUCT",
        title: "100 aguas + 100 barritas de cereal",
        status: "CONFIRMED",
        notes: "quantity composite",
      },
    ],
  },
  {
    key: "copy-express",
    list: "CONFIRMED",
    partner: {
      name: "Copy Express",
      slug: "copy-express",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — rol SPONSOR provisional; decisión humana SPONSOR|COLLABORATOR pendiente.",
    },
    participation: {
      institutionalRole: "SPONSOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      roleDecisionPending: true,
      notes:
        "Rol definitivo SPONSOR|COLLABORATOR requiere decisión humana. IMP02 — cargado como SPONSOR con roleDecisionPending.",
    },
    contributions: [
      {
        type: "OTHER",
        title: "Descuentos y premios según inscriptos",
        status: "PENDING",
      },
    ],
  },
  {
    key: "beba-lopergolo",
    list: "CONFIRMED",
    partner: {
      name: "Beba Lopergolo",
      slug: "beba-lopergolo",
      type: "PERSON",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaboradora persona (clase de pádel).",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaboradora confirmada. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "SERVICE",
        title: "1 clase de pádel",
        quantity: 1,
        status: "CONFIRMED",
      },
    ],
  },
  {
    key: "reggi-vinoteca",
    list: "CONFIRMED",
    partner: {
      name: "Reggi Vinoteca",
      slug: "reggi-vinoteca",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador confirmado (vinos).",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador confirmado. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "PRODUCT",
        title: "3 vinos",
        quantity: 3,
        status: "CONFIRMED",
      },
    ],
  },
  {
    key: "claroscuro",
    list: "CONFIRMED",
    partner: {
      name: "Claroscuro",
      slug: "claroscuro",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador. Revisar identidad/homónimos Claroscuro.",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador. Impresión para futura muestra (aporte pendiente).",
    },
    contributions: [
      {
        type: "SERVICE",
        title: "Impresión para futura muestra",
        status: "PENDING",
      },
    ],
    humanReviewFlags: ["identity:Claroscuro", "homonym_check"],
  },
  {
    key: "cine-monumental",
    list: "CONFIRMED",
    partner: {
      name: "Cine Monumental",
      slug: "cine-monumental",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador. Revisar identidad/dirección del cine.",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador confirmado (entradas). Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "PRIZE",
        title: "4 entradas de cine",
        quantity: 4,
        status: "CONFIRMED",
      },
    ],
    humanReviewFlags: ["identity", "address"],
  },
  {
    key: "fraganshop",
    list: "CONFIRMED",
    partner: {
      name: "Fraganshop",
      slug: "fraganshop",
      type: "BUSINESS",
      status: "ACTIVE",
      instagram: "https://www.instagram.com/fraganshop.ok/",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — colaborador. Instagram fraganshop.ok.",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador. Premios/descuentos pendientes de detalle.",
    },
    contributions: [
      {
        type: "PRIZE",
        title: "10 premios y descuentos",
        status: "PENDING",
      },
    ],
  },
  {
    key: "vicario",
    list: "CONFIRMED",
    partner: {
      name: "Vicario",
      slug: "grupovicario",
      type: "COMPANY",
      status: "ACTIVE",
      instagram: "https://www.instagram.com/grupovicario/",
      notes:
        "Responsable interno Clickatón: Dani. IMP02 lista A — sponsor. Establecer premios concretos. IG grupovicario.",
    },
    participation: {
      institutionalRole: "SPONSOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — sponsor. Establecer premios concretos. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "OTHER",
        title: "Premios y descuentos — falta confirmar detalle concreto",
        status: "PENDING",
        notes: "Establecer premios concretos",
      },
    ],
  },
  {
    key: "fotolag",
    list: "CONFIRMED",
    partner: {
      name: "Fotolag",
      slug: "fotolag",
      type: "BUSINESS",
      status: "ACTIVE",
      instagram: "https://www.instagram.com/fotolagrosario/",
      notes:
        "Responsable interno Clickatón: Dani. IMP02 lista A — sponsor. Coordinar entrega de vouchers. IG fotolagrosario.",
    },
    participation: {
      institutionalRole: "SPONSOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — sponsor. Coordinar entrega de vouchers. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "VOUCHER",
        title: "Vouchers de descuento",
        status: "PENDING",
        notes: "Coordinar entrega",
      },
    ],
  },
  {
    key: "el-baul-del-fotografo",
    list: "CONFIRMED",
    partner: {
      name: "El Baúl del Fotógrafo",
      slug: "el-baul-del-fotografo",
      type: "BUSINESS",
      status: "ACTIVE",
      instagram: "https://www.instagram.com/elbauldelfotografo/",
      email: "marcos.piaggio@hotmail.com",
      phone: "3413618099",
      description: "Corrientes 1855, Rosario, Santa Fe, Argentina",
      notes:
        "Responsable interno Clickatón: Dani. IMP02 lista A — sponsor. Contacto Marcos Piaggio. Dirección Corrientes 1855 Rosario.",
    },
    participation: {
      institutionalRole: "SPONSOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — sponsor. Premios y vouchers pendientes de detalle.",
    },
    contributions: [
      {
        type: "PRIZE",
        title: "Premios y vouchers",
        status: "PENDING",
      },
    ],
  },
  {
    key: "photostraps",
    list: "CONFIRMED",
    partner: {
      name: "PhotoStraps",
      slug: "photostraps",
      type: "BRAND",
      status: "ACTIVE",
      instagram: "https://www.instagram.com/photostrapsarg/",
      notes:
        "Responsable interno Clickatón: Dani. IMP02 lista A — sponsor. Coordinar entrega / confirmar aporte. Aporte aún undefined.",
    },
    participation: {
      institutionalRole: "SPONSOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "Coordinar entrega / confirmar aporte. IMP02 — sin contribution hasta confirmación humana.",
    },
    // contributions intentionally omitted (undefined)
    humanReviewFlags: ["aporte_undefined", "confirm_contribution"],
  },
  {
    key: "arenhas-bar",
    list: "CONFIRMED",
    partner: {
      name: "Arenhas Bar",
      slug: "arenhas-bar",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Tammy. IMP02 lista A — colaborador. Revisar spelling/web (Arenhas).",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador confirmado (cenas). Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "SERVICE",
        title: "2 cenas completas",
        quantity: 2,
        status: "CONFIRMED",
      },
    ],
    humanReviewFlags: ["spelling", "web"],
  },
  {
    key: "spa-carobig",
    list: "CONFIRMED",
    partner: {
      name: "Spa CaroBig",
      slug: "spa-carobig",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Tammy. IMP02 lista A — colaborador confirmado (tratamiento spa).",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador confirmado. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "SERVICE",
        title: "Limpieza de cutis + depilación o tratamiento a elección",
        status: "CONFIRMED",
      },
    ],
  },
  {
    key: "feca",
    list: "CONFIRMED",
    partner: {
      name: "FECA",
      slug: "feca",
      type: "BUSINESS",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Tammy. IMP02 lista A — colaborador. Desayunos/meriendas confirmados; catering maratón pendiente.",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador. Catering del día de la maratón PENDING_CONFIRMATION.",
    },
    contributions: [
      {
        type: "SERVICE",
        title: "Desayunos o meriendas",
        status: "CONFIRMED",
      },
      {
        type: "SERVICE",
        title: "Posible catering el día de la maratón",
        status: "PENDING",
        notes: "PENDING_CONFIRMATION",
      },
    ],
  },
  {
    key: "mucha-escuela",
    list: "CONFIRMED",
    partner: {
      name: "Mucha Escuela",
      slug: "mucha-escuela",
      type: "ORGANIZATION",
      status: "ACTIVE",
      notes:
        "Responsable interno Clickatón: Tammy. IMP02 lista A — colaborador. Becas/clases pendientes de detalle.",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes: "IMP02 — colaborador. Becas/clases pendientes.",
    },
    contributions: [
      {
        type: "SERVICE",
        title: "Becas / clases",
        status: "PENDING",
      },
    ],
  },
  {
    key: "centro-cultural-roberto-fontanarrosa",
    list: "CONFIRMED",
    partner: {
      name: "Centro Cultural Roberto Fontanarrosa",
      slug: "centro-cultural-roberto-fontanarrosa",
      type: "INSTITUTION",
      status: "ACTIVE",
      email: "info-ccrf@rosario.gov.ar",
      phone: "4802401",
      description: "San Martín 1080, Rosario, Santa Fe",
      notes:
        "Responsable interno Clickatón: Rodri. IMP02 lista A — institución sede. Rol INSTITUTIONAL_SPONSOR (alternativa COLLABORATOR descartada en import).",
    },
    participation: {
      institutionalRole: "INSTITUTIONAL_SPONSOR",
      displayTier: "INSTITUTIONAL",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes:
        "IMP02 — sede institucional. Uso del espacio confirmado; premiaciones a confirmar. Visibilidad pública oculta hasta publicación.",
    },
    contributions: [
      {
        type: "VENUE",
        title: "Uso del espacio el día del evento",
        status: "CONFIRMED",
      },
      {
        type: "OTHER",
        title: "Premiaciones a confirmar",
        status: "PENDING",
      },
    ],
  },
  {
    key: "andres-preumayr",
    list: "CONFIRMED",
    partner: {
      name: "Andrés Preumayr",
      slug: "andres-preumayr",
      type: "PERSON",
      status: "ACTIVE",
      instagram: "https://www.instagram.com/andres.preumayr/",
      notes:
        "Responsable interno Clickatón: Dani. IMP02 lista A — colaborador persona. No duplicar jurado canónico; relación externa.",
    },
    participation: {
      institutionalRole: "COLLABORATOR",
      displayTier: "STANDARD",
      status: "CONFIRMED",
      publicVisibility: "HIDDEN",
      requiresPayment: false,
      notes:
        "IMP02 — colaborador. Jurado como relación externa (no duplicar jurado canónico). Descuento cursos online pendiente.",
    },
    contributions: [
      {
        type: "SERVICE",
        title: "Jurado (relación externa)",
        status: "PENDING",
        notes: "no duplicar jurado canónico",
      },
      {
        type: "DISCOUNT",
        title: "Descuento en cursos online",
        status: "PENDING",
      },
    ],
  },

  // ─── LIST B — PROSPECTS (no participation, no contributions) ────────
  {
    key: "enchulame-la-camara",
    list: "PROSPECT",
    partner: {
      name: "Enchulame la Cámara",
      slug: "enchulame-la-camara",
      type: "BUSINESS",
      status: "PROSPECT",
      instagram: "https://www.instagram.com/enchulame.la.camara.ar/",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect. IG enchulame.la.camara.ar.",
    },
  },
  {
    key: "tecnoflash",
    list: "PROSPECT",
    partner: {
      name: "Tecnoflash",
      slug: "tecnoflash",
      type: "BUSINESS",
      status: "PROSPECT",
      instagram: "https://www.instagram.com/tecnoflash_fotografia/",
      phone: null,
      description: "Valparaíso 1178, Rosario",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect. Ambos teléfonos +54 341 435-4076 y 341 547-9664 requieren validación humana; phone field null.",
    },
  },
  {
    key: "recupero-datos",
    list: "PROSPECT",
    partner: {
      name: "Recupero Datos",
      slug: "recupero-datos",
      type: "BUSINESS",
      status: "PROSPECT",
      instagram: "https://www.instagram.com/recuperodatos/",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect. IG recuperodatos.",
    },
  },
  {
    key: "scoopx",
    list: "PROSPECT",
    partner: {
      name: "SCOOPX",
      slug: "scoopx",
      type: "BUSINESS",
      status: "PROSPECT",
      instagram: "https://www.instagram.com/scoxdatarecovery/",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect. Nombre SCOOPX vs handle scoxdatarecovery; identityVerificationStatus=PENDING.",
    },
    humanReviewFlags: ["identityVerificationStatus=PENDING", "name_vs_handle"],
  },
  {
    key: "congreso-nomade",
    list: "PROSPECT",
    partner: {
      name: "Congreso Nómade",
      slug: "congreso-nomade",
      type: "ORGANIZATION",
      status: "PROSPECT",
      websiteUrl: "https://congresonomade.com/",
      email: "congresonomade@gmail.com",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect. Potential STRATEGIC_PARTNER|MEDIA_PARTNER.",
    },
  },
  {
    key: "terra-congreso-fotonaturaleza",
    list: "PROSPECT",
    partner: {
      name: "Terra",
      slug: "terra-congreso-fotonaturaleza",
      type: "ORGANIZATION",
      status: "PROSPECT",
      websiteUrl: "https://www.congreso-terra.com/",
      description: "San Carlos de Bariloche, Río Negro",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect. Congreso Terra / foto naturaleza. Bariloche.",
    },
  },
  {
    key: "bienal-argentina-fotografia-documental",
    list: "PROSPECT",
    partner: {
      name: "Bienal Argentina de Fotografía Documental",
      slug: "bienal-argentina-fotografia-documental",
      type: "ORGANIZATION",
      status: "PROSPECT",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect mínimo (sin web/IG en lista operador).",
    },
  },
  {
    key: "fdf-argentina",
    list: "PROSPECT",
    partner: {
      name: "FDF Argentina",
      slug: "fdf-argentina",
      type: "ORGANIZATION",
      status: "PROSPECT",
      websiteUrl: "https://fdfargentina.com.ar/",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect.",
    },
  },
  {
    key: "afona",
    list: "PROSPECT",
    partner: {
      name: "AFONA",
      legalName: "Asociación Argentina de Fotógrafos de Naturaleza",
      slug: "afona",
      type: "ORGANIZATION",
      status: "PROSPECT",
      websiteUrl: "https://afona.org.ar/",
      email: "webafona@gmail.com",
      notes:
        "Responsable interno Clickatón: pendiente. IMP02 lista B — prospect. También auspicios@afona.org.ar; potential STRATEGIC_PARTNER.",
    },
  },
];
