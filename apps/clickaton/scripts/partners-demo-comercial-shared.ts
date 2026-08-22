/**
 * Campaña "[DEMO COMERCIAL] DNX Partners" — definición y guardas compartidas.
 *
 * Lo usan el seed (`partners-demo-comercial-seed.ts`) y la limpieza
 * (`partners-demo-comercial-cleanup.ts`). Ninguno de los dos toca producción:
 * las guardas de este archivo abortan antes de abrir una conexión.
 */

/** Prefijo literal. Todo lo que crea el seed lo lleva, y la limpieza borra por él. */
export const DEMO_PREFIX = "[DEMO COMERCIAL]";

/** Prefijo de los slugs de partner y de las claves de tracking. */
export const DEMO_SLUG_PREFIX = "demo-comercial-";

/** Hosts donde SÍ se permite escribir. Cualquier otro aborta. */
const ALLOWED_DB_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
  "postgres",
  "db",
  "database",
]);

/**
 * Fragmentos que delatan una base remota. Se comprueban sobre la URL completa,
 * por si alguien pasa un host que no cae en la whitelist pero tampoco es local.
 */
const FORBIDDEN_URL_FRAGMENTS = [
  "neon.tech",
  "aws",
  "azure",
  "gcp",
  "supabase",
  "vercel",
  "render.com",
  "railway",
  "pooler",
  "ep-",
  "br-",
  "divine-hall",
];

/** Variables que activarían la publicación multi-base. Deben estar ausentes. */
export const PUBLICATION_ENV_NAMES = [
  "DNX_PARTNERS_INFOSPOT_DATABASE_URL",
  "DNX_PARTNERS_CLF_DATABASE_URL",
  "DNX_PARTNERS_FOTORANK_DATABASE_URL",
] as const;

export class DemoGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoGuardError";
  }
}

function maskUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "(URL ilegible)";
  }
}

/**
 * Aborta si el entorno no es seguro. Se llama ANTES de cualquier consulta.
 * No imprime credenciales: solo protocolo, host, puerto y nombre de base.
 */
export function assertSafeEnvironment(action: string): { hostLabel: string } {
  if (process.env.NODE_ENV === "production") {
    throw new DemoGuardError(
      `${action} abortado: NODE_ENV=production. Este script no corre en producción.`,
    );
  }

  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new DemoGuardError(
      `${action} abortado: falta DATABASE_URL. Apuntala a una base local efímera.`,
    );
  }

  const lower = raw.toLowerCase();
  const hit = FORBIDDEN_URL_FRAGMENTS.find((f) => lower.includes(f));
  if (hit) {
    throw new DemoGuardError(
      `${action} abortado: DATABASE_URL contiene "${hit}", que indica una base remota. ` +
        `Destino leído: ${maskUrl(raw)}`,
    );
  }

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new DemoGuardError(`${action} abortado: DATABASE_URL no es una URL válida.`);
  }

  if (!ALLOWED_DB_HOSTS.has(host)) {
    throw new DemoGuardError(
      `${action} abortado: el host "${host}" no está en la lista de destinos permitidos ` +
        `(${[...ALLOWED_DB_HOSTS].join(", ")}). Destino leído: ${maskUrl(raw)}`,
    );
  }

  const publication = PUBLICATION_ENV_NAMES.filter((n) => process.env[n]?.trim());
  if (publication.length > 0) {
    throw new DemoGuardError(
      `${action} abortado: están definidas ${publication.join(", ")}. ` +
        `Sacalas del entorno: con ellas cargadas existe el riesgo de publicar la campaña ` +
        `de demostración a las bases reales de InfoSpot, CLF o FotoRank.`,
    );
  }

  return { hostLabel: maskUrl(raw) };
}

/* ------------------------------------------------------------------ */
/* Definición de la campaña                                            */
/* ------------------------------------------------------------------ */

export type DemoApplication =
  | "CLICKATON"
  | "FOTO_RANK"
  | "INFO_SPOT"
  | "COMPRAME_LA_FOTO";

export type DemoCreativePlan = {
  placementKeys: readonly string[];
  format:
    | "LOGO_MARQUEE"
    | "BANNER_HORIZONTAL"
    | "WELCOME_INTERSTITIAL";
  title: string;
  body: string;
  ctaText: string;
  /** Placement de tracking del catálogo, para el outbound link. */
  trackingPlacement: "LOGO_MARQUEE" | "BANNER" | "HOME_INLINE" | "WELCOME";
};

export type DemoBrand = {
  slug: string;
  name: string;
  description: string;
  /** Logo sobre placa uniforme, servido por `public/partners-demo/` de cada app. */
  assetFile: string;
  /**
   * Pieza gráfica completa 1:1 para la placa de bienvenida. Cuando existe, el
   * modal la muestra sola: el mensaje ya está en la imagen, como haría una
   * creatividad entregada por el anunciante.
   */
  creativeFile?: string;
  assetType: "LOGO_HORIZONTAL" | "LOGO_PRIMARY" | "LOGO_GENERAL";
  width: number;
  height: number;
  aspectRatio: string;
  campaigns: ReadonlyArray<{
    application: DemoApplication;
    creatives: readonly DemoCreativePlan[];
  }>;
};

/**
 * Ocho marcas en orden intercalado: cliente · ecosistema · cliente · ecosistema…
 *
 * Los tres primeros son clientes reales ya publicados como aliados en el sitio.
 * Los cinco restantes son las plataformas del propio ecosistema, que se anuncian
 * entre sí (promoción cruzada). Ninguna aparece dentro de su propia app.
 *
 * Los archivos de `public/partners-demo/` son las variantes oficiales de cada
 * marca sobre una placa uniforme: cada logo trae su propio tratamiento de
 * contraste y la placa es lo que los vuelve legibles en cualquier superficie.
 * `banner-<slug>.png` es la variante apaisada 4:1 para el banner horizontal.
 */
export const DEMO_BRANDS: readonly DemoBrand[] = [
  {
    slug: `${DEMO_SLUG_PREFIX}copy-express`,
    name: `${DEMO_PREFIX} COPY express`,
    description: "Centro de imágenes digitales. Cliente real, ya publicado como aliado.",
    assetFile: "/partners-demo/copy-express.png",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "COPY express acompaña este evento",
            body: "Centro de imágenes digitales. Impresión y copias en el día.",
            ctaText: "Conocer COPY express",
            trackingPlacement: "WELCOME",
          },
          {
            placementKeys: ["INFOSPOT_HOME_TOP", "INFOSPOT_HOME_INLINE"],
            format: "BANNER_HORIZONTAL",
            title: "COPY express — centro de imágenes digitales",
            body: "Impresión y copias en el día.",
            ctaText: "Ver la propuesta",
            trackingPlacement: "BANNER",
          },
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "COPY express",
            body: "Centro de imágenes digitales.",
            ctaText: "Conocer COPY express",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "COPY express",
            body: "Centro de imágenes digitales.",
            ctaText: "Conocer COPY express",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "COPY express",
            body: "Centro de imágenes digitales.",
            ctaText: "Conocer COPY express",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}clickaton`,
    name: `${DEMO_PREFIX} Clickatón`,
    description: "Maratones fotográficas. Ecosistema DNX.",
    assetFile: "/partners-demo/clickaton.png",
    assetType: "LOGO_PRIMARY",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Clickatón",
            body: "Maratones fotográficas.",
            ctaText: "Conocer Clickatón",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Clickatón",
            body: "Maratones fotográficas.",
            ctaText: "Conocer Clickatón",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}dvv`,
    name: `${DEMO_PREFIX} DVV`,
    description: "Digital Video Vica. Cliente real, ya publicado como aliado.",
    assetFile: "/partners-demo/dvv.png",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_ALBUM_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "DVV Digital Video",
            body: "Producción audiovisual para eventos y marcas.",
            ctaText: "Conocer DVV",
            trackingPlacement: "WELCOME",
          },
          {
            placementKeys: ["CLF_HOME_PROMO"],
            format: "BANNER_HORIZONTAL",
            title: "DVV — producción audiovisual",
            body: "Video para eventos y marcas.",
            ctaText: "Ver la propuesta",
            trackingPlacement: "BANNER",
          },
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "DVV",
            body: "Producción audiovisual.",
            ctaText: "Conocer DVV",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "DVV",
            body: "Producción audiovisual.",
            ctaText: "Conocer DVV",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "DVV",
            body: "Producción audiovisual.",
            ctaText: "Conocer DVV",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}fotorank`,
    name: `${DEMO_PREFIX} FotoRank`,
    description: "Concursos de fotografía. Ecosistema DNX.",
    assetFile: "/partners-demo/fotorank.png",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_EVENT_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "¿Ya conocés FotoRank?",
            body: "Concursos de fotografía con jurado y votación del público.",
            ctaText: "Ver los concursos abiertos",
            trackingPlacement: "WELCOME",
          },
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "FotoRank",
            body: "Concursos de fotografía.",
            ctaText: "Conocer FotoRank",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "FotoRank",
            body: "Concursos de fotografía.",
            ctaText: "Conocer FotoRank",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "FotoRank",
            body: "Concursos de fotografía.",
            ctaText: "Conocer FotoRank",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}mucha-escuela`,
    name: `${DEMO_PREFIX} Mucha Escuela`,
    description: "Formación para creadores. Cliente real, ya publicado como aliado.",
    assetFile: "/partners-demo/mucha-escuela.png",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "FOTO_RANK",
        creatives: [
          {
            placementKeys: ["FOTORANK_CONTEST_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "Mucha Escuela",
            body: "Formación para creadores. Cursos y talleres todo el año.",
            ctaText: "Ver los cursos",
            trackingPlacement: "WELCOME",
          },
        ],
      },
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Mucha Escuela",
            body: "Formación para creadores.",
            ctaText: "Ver los cursos",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Mucha Escuela",
            body: "Formación para creadores.",
            ctaText: "Ver los cursos",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Mucha Escuela",
            body: "Formación para creadores.",
            ctaText: "Ver los cursos",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}compramelafoto`,
    name: `${DEMO_PREFIX} ComprameLaFoto`,
    description: "Venta de fotografía de eventos. Ecosistema DNX.",
    assetFile: "/partners-demo/compramelafoto.png",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "ComprameLaFoto",
            body: "Tus fotos del evento.",
            ctaText: "Buscar mis fotos",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "ComprameLaFoto",
            body: "Tus fotos del evento.",
            ctaText: "Buscar mis fotos",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}infospot`,
    name: `${DEMO_PREFIX} InfoSpot`,
    description: "Medio editorial del ecosistema DNX.",
    assetFile: "/partners-demo/infospot.png",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "InfoSpot",
            body: "Cobertura editorial de eventos.",
            ctaText: "Leer InfoSpot",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "InfoSpot",
            body: "Cobertura editorial de eventos.",
            ctaText: "Leer InfoSpot",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}fotoffice`,
    name: `${DEMO_PREFIX} FotoOffice`,
    description:
      "Gestión para estudios fotográficos. Aparece como ANUNCIANTE en las otras plataformas; " +
      "no se monta ninguna superficie publicitaria dentro de FotoOffice.",
    assetFile: "/partners-demo/fotoffice.png",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "FotoOffice",
            body: "Gestión para estudios fotográficos.",
            ctaText: "Conocer FotoOffice",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "FotoOffice",
            body: "Gestión para estudios fotográficos.",
            ctaText: "Conocer FotoOffice",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "FotoOffice",
            body: "Gestión para estudios fotográficos.",
            ctaText: "Conocer FotoOffice",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}photostraps`,
    name: `${DEMO_PREFIX} PhotoStraps`,
    description: "Accesorios de fotografía. Anunciante con pieza gráfica propia.",
    assetFile: "/partners-demo/photostraps.png",
    creativeFile: "/partners-demo/creative-photostraps.jpg",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "Tu cámara merece una buena correa",
            body: "Cuero genuino, cosida a mano.",
            ctaText: "Ver el catálogo",
            trackingPlacement: "WELCOME",
          },
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "PhotoStraps",
            body: "Accesorios de fotografía.",
            ctaText: "Ver el catálogo",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_EVENT_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "Tu cámara merece una buena correa",
            body: "Cuero genuino, cosida a mano.",
            ctaText: "Ver el catálogo",
            trackingPlacement: "WELCOME",
          },
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "PhotoStraps",
            body: "Accesorios de fotografía.",
            ctaText: "Ver el catálogo",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_HOME_PROMO"],
            format: "BANNER_HORIZONTAL",
            title: "PhotoStraps — accesorios de fotografía",
            body: "Correas de cuero genuino, cosidas a mano.",
            ctaText: "Ver el catálogo",
            trackingPlacement: "BANNER",
          },
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "PhotoStraps",
            body: "Accesorios de fotografía.",
            ctaText: "Ver el catálogo",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
  {
    slug: `${DEMO_SLUG_PREFIX}terraza-bistro`,
    name: `${DEMO_PREFIX} Terraza Bistró`,
    description: "Gastronomía. Anunciante con pieza gráfica propia.",
    assetFile: "/partners-demo/terraza-bistro.png",
    creativeFile: "/partners-demo/creative-terraza-bistro.jpg",
    assetType: "LOGO_HORIZONTAL",
    width: 520,
    height: 260,
    aspectRatio: "2:1",
    campaigns: [
      {
        application: "COMPRAME_LA_FOTO",
        creatives: [
          {
            placementKeys: ["CLF_ALBUM_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "Después de la foto, la mesa",
            body: "Reservá online y sentate donde termina el día.",
            ctaText: "Reservar mesa",
            trackingPlacement: "WELCOME",
          },
          {
            placementKeys: ["CLF_LOGO_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Terraza Bistró",
            body: "Cocina de autor.",
            ctaText: "Reservar mesa",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "FOTO_RANK",
        creatives: [
          {
            placementKeys: ["FOTORANK_CONTEST_WELCOME"],
            format: "WELCOME_INTERSTITIAL",
            title: "Después de la foto, la mesa",
            body: "Reservá online y sentate donde termina el día.",
            ctaText: "Reservar mesa",
            trackingPlacement: "WELCOME",
          },
        ],
      },
      {
        application: "INFO_SPOT",
        creatives: [
          {
            placementKeys: ["INFOSPOT_HOME_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Terraza Bistró",
            body: "Cocina de autor.",
            ctaText: "Reservar mesa",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
      {
        application: "CLICKATON",
        creatives: [
          {
            placementKeys: ["CLICKATON_HOME_MARQUEE", "CLICKATON_EVENT_MARQUEE"],
            format: "LOGO_MARQUEE",
            title: "Terraza Bistró",
            body: "Cocina de autor.",
            ctaText: "Reservar mesa",
            trackingPlacement: "LOGO_MARQUEE",
          },
        ],
      },
    ],
  },
];

/** Los 11 placements montados hoy en este worktree. El seed los cubre todos. */
export const EXPECTED_PLACEMENT_KEYS = [
  "CLICKATON_EVENT_WELCOME",
  "CLICKATON_HOME_MARQUEE",
  "CLICKATON_EVENT_MARQUEE",
  "FOTORANK_CONTEST_WELCOME",
  "INFOSPOT_HOME_WELCOME",
  "INFOSPOT_HOME_TOP",
  "INFOSPOT_HOME_INLINE",
  "INFOSPOT_HOME_MARQUEE",
  "CLF_ALBUM_WELCOME",
  "CLF_HOME_PROMO",
  "CLF_LOGO_MARQUEE",
] as const;

/**
 * Destino de los enlaces.
 * Clickatón corre en el 3005 (`next dev --port 3005`); el 3000 es FotoRank.
 */
export function demoDestinationBaseUrl(): string {
  return (
    process.env.DEMO_PARTNERS_DESTINATION_URL?.trim() ||
    "http://localhost:3005/demo-partners"
  );
}

/** Destino por marca, para que la landing sepa de dónde vino el clic. */
export function demoDestinationUrl(brandSlug?: string): string {
  const base = demoDestinationBaseUrl();
  if (!brandSlug) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}marca=${encodeURIComponent(brandSlug)}`;
}

/** Nombre de campaña derivado de la marca y la aplicación. Estable = idempotente. */
export function demoCampaignName(brandName: string, application: string): string {
  return `${brandName} · ${application}`;
}

/** Clave de tracking estable por marca, aplicación y placement de tracking. */
export function demoTrackingKey(
  brandSlug: string,
  application: string,
  trackingPlacement: string,
): string {
  return `${brandSlug}-${application}-${trackingPlacement}`.toLowerCase();
}
