import { ORIGEN_ALBOOM } from "@/lib/website/redirecciones-reglas";

/**
 * Lo que es propio del sitio de DNX Fotografía en Alboom (`www.dnxfotografia.com.ar`): qué se
 * trae, con qué direcciones nuevas, y los datos fijos de la portada y el menú. Valores tomados del
 * plan del PR 4 (`docs/superpowers/plans/2026-10-26-sitio-pr4-importador-alboom.md`) y del spec
 * (`docs/superpowers/specs/2026-10-26-sitio-dnx-desde-alboom-design.md`).
 */

export const BASE_ALBOOM_DNX = "https://www.dnxfotografia.com.ar";
export const WORKSPACE_DNX = "cmv5z6qxwwmmhf0q5gp8qja1j";
export const SLUG_PUBLICO_DNX = "dnx-estudio";
/** Así se marcan los trabajos (`origenExterno`) y las redirecciones (`origen`) que trajo el importador. */
export const ORIGEN_IMPORTACION = ORIGEN_ALBOOM;

/** Los 31 artículos publicados (ids de Alboom, leídos del panel el 26/10). Incluye Selpix (320993). */
export const ARTICULOS_DNX = [
  "476452", "446766", "394647", "367249", "367247", "320993", "305804", "195938", "146935", "122043",
  "116089", "111321", "100049", "92784", "92781", "89987", "89977", "89679", "89675", "89594",
  "89593", "75450", "71826", "65558", "65554", "45061", "37919", "37204", "35176", "25164", "25161",
] as const;

/** Slugs limpios para los títulos con restos del generador de textos; el resto usa el de Alboom sin el número. */
export const SLUGS_LIMPIOS: Readonly<Record<string, string>> = {
  "111321": "celebra-a-lo-grande-con-invitaciones-virtuales-y-packs",
  "146935": "descubri-el-canal-de-youtube-de-dnx-estudio",
  "195938": "cuidar-nuestros-oidos-ear-clogs",
  "89593": "por-que-necesitas-tu-propia-pagina-web",
  "89594": "eleva-tu-fotografia-con-alboomcrm",
  "446766": "que-es-comprame-la-foto",
};

export const AUTOR_BLOG = { nombre: "Daniel Cuart", slug: "daniel-cuart" } as const;

/** Categorías de trabajos. `alboom` son los slugs de categoría de Alboom que caen en cada una. */
export const CATEGORIAS_TRABAJOS: ReadonlyArray<{ slug: string; nombre: string; alboom: readonly string[] }> = [
  { slug: "books", nombre: "Books", alboom: ["books"] },
  { slug: "fiestas-de-xv", nombre: "Fiestas de XV", alboom: ["fiestas"] },
  { slug: "bodas", nombre: "Bodas", alboom: ["bodas"] },
  { slug: "arquitectura", nombre: "Arquitectura", alboom: ["arquitectura"] },
  { slug: "graduaciones", nombre: "Graduaciones", alboom: [] },
  { slug: "videos", nombre: "Videos", alboom: [] },
];

/** Las 5 galerías de Alboom entran como trabajos en estas categorías. */
export const CATEGORIA_DE_GALERIA: Readonly<Record<string, string>> = {
  "12070": "books",
  "12073": "bodas",
  "19953": "graduaciones",
  "21382": "videos",
  "87092": "fiestas-de-xv",
};

/** Cuántas fotos de trabajos destacados lleva el carrusel de la portada. */
export const FOTOS_DEL_CARRUSEL = 5;

export type PaginaAImportar = {
  /** Dirección nueva (página propia del sitio). */
  slug: string;
  /** Ruta en Alboom. */
  alboom: string;
  /** Nombre de la página (y del menú). Sin esto, el título de la página de Alboom. */
  titulo?: string;
  /** Qué se le agrega al final, según el spec. */
  agregar?: Array<"PRESUPUESTO" | "WHATSAPP" | "TESTIMONIOS">;
};

/** Páginas propias migradas (slug FOTOFFICE ← Alboom), con las landings de cursos y servicios en línea. */
export const PAGINAS_DNX: readonly PaginaAImportar[] = [
  { slug: "quien-soy", alboom: "/sobre", titulo: "Quién soy", agregar: ["PRESUPUESTO"] },
  { slug: "agenda", alboom: "/agenda", titulo: "Agendá un turno", agregar: ["PRESUPUESTO", "WHATSAPP"] },
  { slug: "capacitate", alboom: "/cursos", titulo: "Capacitate", agregar: ["TESTIMONIOS"] },
  { slug: "imprimi-tus-fotos", alboom: "/imprimir", titulo: "Imprimí tus fotos" },
  { slug: "curso-xv", alboom: "/cursoxv" },
  { slug: "curso-celular", alboom: "/celular" },
  { slug: "curso-lightroom", alboom: "/cursolightroom" },
  { slug: "fotografia-inicial", alboom: "/fotografia-inicial" },
  { slug: "workshop-xv", alboom: "/workshopxv" },
  { slug: "consultorias", alboom: "/consultorias" },
  { slug: "taller-presupuestos", alboom: "/tallerpresupuestos" },
  { slug: "curso-eventos", alboom: "/curso_eventos" },
  { slug: "mentoria-1a1", alboom: "/1a1" },
  { slug: "planilla-presupuesto", alboom: "/xlspresupuesto" },
  { slug: "visita-virtual", alboom: "/visitavirtual" },
  { slug: "calendario-360", alboom: "/calendario360" },
  { slug: "la-isla", alboom: "/laisla" },
];

/**
 * Redirecciones fijas (rutas del sitio, sin `/w/<slug>`). Las de artículos, trabajos, galerías,
 * categorías, páginas y landings se arman con lo importado (ver `cargar.ts`).
 */
export const REDIRECCIONES_FIJAS: ReadonlyArray<{ desde: string; hacia: string; codigo: 301 | 302 }> = [
  { desde: "/home", hacia: "/", codigo: 301 },
  { desde: "/sobre", hacia: "/quien-soy", codigo: 301 },
  { desde: "/contato", hacia: "/presupuesto", codigo: 301 },
  { desde: "/contacto-2", hacia: "/presupuesto", codigo: 301 },
  { desde: "/depoimento", hacia: "/testimonio", codigo: 301 },
  { desde: "/cursos", hacia: "/capacitate", codigo: 301 },
  { desde: "/imprimir", hacia: "/imprimi-tus-fotos", codigo: 301 },
  { desde: "/agenda2024", hacia: "/", codigo: 301 },
  { desde: "/datos", hacia: "/", codigo: 301 },
  { desde: "/prueba", hacia: "/", codigo: 301 },
  { desde: "/prueba-sfpr", hacia: "/", codigo: 301 },
  { desde: "/portfolio", hacia: "/trabajos", codigo: 301 },
  { desde: "/galerias", hacia: "/trabajos", codigo: 301 },
  { desde: "/portfolio/trabalhos", hacia: "/trabajos", codigo: 301 },
  // Las del sitemap que no estaban en la lista del plan: la lista general de galerías, la de
  // testimonios, otra página de prueba y el contacto en castellano.
  { desde: "/galleries", hacia: "/trabajos", codigo: 301 },
  { desde: "/testimonials", hacia: "/testimonios", codigo: 301 },
  { desde: "/prueba-2", hacia: "/", codigo: 301 },
  { desde: "/contacto", hacia: "/presupuesto", codigo: 301 },
  // Las galerías de clientes siguen en Alboom mientras exista.
  { desde: "/proof/*", hacia: "https://dnxfotografia.alboompro.com/proof/*", codigo: 302 },
];

/** Rutas del sitemap que no son landings (tienen su redirección fija, su página o son del listado). */
export const RUTAS_CONOCIDAS: readonly string[] = ["/", ...REDIRECCIONES_FIJAS.map((r) => r.desde), ...PAGINAS_DNX.map((p) => p.alboom)];

export const LOGO_ALBOOM_DNX = "https://storage.alboom.ninja/sites/8403/img/log.png";

/** Datos de contacto de DNX (los de `/contato` y el pie del sitio viejo). */
export const CONTACTO_DNX = {
  email: "dnxfotografia@gmail.com",
  phone: "+54 9 341 374-8324",
  whatsapp: "341 341-9869",
  whatsappText: "¡Hola! Estaba visitando tu página web, ¿podrías pasarme información?",
  address: "San José 1672, Local 5, Funes, Santa Fe",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=San+Jos%C3%A9+1672%2C+Funes%2C+Santa+Fe",
  socials: [
    { network: "instagram", url: "https://instagram.com/dnxfotografia" },
    { network: "facebook", url: "https://facebook.com/dnxfotografia" },
    { network: "youtube", url: "https://youtube.com/channel/UCq4YXDFcfJZGt1TZRdeoBBA" },
    { network: "vimeo", url: "https://vimeo.com/dnxfotografia" },
    { network: "pinterest", url: "https://pinterest.com/dnxfotografia" },
    { network: "linkedin", url: "https://www.linkedin.com/in/danielcuart" },
  ],
} as const;

export const TIENDA_ONLINE_DNX = "https://www.dnxshop.com.ar/";

export const CONSENTIMIENTO_IMPORTADO = "Publicado por el autor en el sitio anterior (Alboom)";
