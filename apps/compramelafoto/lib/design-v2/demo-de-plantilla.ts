/**
 * Datos de demostración para mostrar una plantilla «terminada», como la recibiría una familia:
 * retrato, foto grupal, con la maestra, con amigos, una foto libre, logo de colegio, nombre del
 * alumno, curso, colegio y compañeros.
 *
 * Las fotos son archivos fijos en R2 (`template-v2/demo/`). Cada hueco de foto se llena según su
 * ranura (`photo_individual`, `photo_group`, `photo_teacher`, `photo_friends`, `photo_extra`), el
 * nivel de la plantilla (`metaJson.categoria`) y, en las religiosas, el evento
 * (`metaJson.evento`). Dentro del nivel va una nena o un nene según la plantilla, siempre el
 * mismo. Si un archivo todavía no está, quien lo usa pone la foto de muestra gris
 * (ver `FOTO_DE_MUESTRA_SVG`).
 *
 * Puro y sin dependencias: lo usan el servidor (miniaturas, ruta de la vista 3D) y el navegador.
 * Los textos salen de `valoresDeDemo` (en `demo-valores.ts`).
 */

export const CARPETA_DEMO = "template-v2/demo";

export type NivelDemo = "jardin" | "primaria" | "secundaria" | "egresados";
export type LogoDemo = "logo-escudo-clasico.png" | "logo-moderno.png";
/** 1 = nena, 2 = nene. */
export type VarianteDemo = 1 | 2;
/** Qué foto pide un hueco. */
export type RanuraDemo = "individual" | "grupal" | "maestra" | "amigos" | "extra";
export type EventoDemo = "comunion" | "confirmacion" | null;

/** Todos los archivos que se esperan en `template-v2/demo/`, con su nombre exacto. */
export const ARCHIVOS_DEMO: readonly string[] = [
  ...(["jardin", "primaria", "secundaria", "egresados"] as const).flatMap((n) => [
    `retrato-${n}-1.jpg`,
    `retrato-${n}-2.jpg`,
  ]),
  "grupal-jardin.jpg",
  "grupal-primaria.jpg",
  "grupal-secundaria.jpg",
  "grupal-egresados.jpg",
  "con-maestra-jardin.jpg",
  "con-maestra-primaria.jpg",
  "amigos-primaria.jpg",
  "amigos-secundaria.jpg",
  "amigos-egresados.jpg",
  "libre-patio.jpg",
  "comunion-retrato-1.jpg",
  "comunion-retrato-2.jpg",
  "comunion-grupal.jpg",
  "comunion-con-catequista.jpg",
  "comunion-detalle.jpg",
  "confirmacion-retrato.jpg",
  "confirmacion-grupal.jpg",
  "logo-escudo-clasico.png",
  "logo-moderno.png",
];

/** La ranura de una variable de imagen, o null si no es un hueco de foto. `photo_<n>` es un retrato. */
export function ranuraDeVariable(key: string | null | undefined): RanuraDemo | null {
  switch (key) {
    case "photo_individual":
      return "individual";
    case "photo_group":
      return "grupal";
    case "photo_teacher":
      return "maestra";
    case "photo_friends":
      return "amigos";
    case "photo_extra":
      return "extra";
    default:
      return key && /^photo_\d+$/.test(key) ? "individual" : null;
  }
}

/** El evento religioso de la plantilla, si lo es. Una «Religioso» sin evento se toma como comunión. */
export function eventoDemo(categoria: string | null | undefined, evento: string | null | undefined): EventoDemo {
  const e = sinTildes(evento ?? "");
  if (e.includes("comunion")) return "comunion";
  if (e.includes("confirmacion")) return "confirmacion";
  return sinTildes(categoria ?? "").includes("religios") ? "comunion" : null;
}

function textoDeMeta(meta: unknown, campo: string): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const v = (meta as Record<string, unknown>)[campo];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}


function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** La categoría guardada en el meta de la versión ("Jardín", "Formal"…), o null. */
export function categoriaDeMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const c = (meta as Record<string, unknown>).categoria;
  return typeof c === "string" && c.trim() ? c.trim() : null;
}

/**
 * Nivel de las fotos de muestra para una categoría. Las que no son de un nivel escolar
 * («Formal», «Informal» u otras) usan el que mejor les queda: lo formal, secundaria; lo demás,
 * primaria.
 */
export function nivelDemoDeCategoria(categoria: string | null | undefined): NivelDemo {
  const c = sinTildes(categoria ?? "");
  if (c.includes("jardin") || c.includes("inicial")) return "jardin";
  if (c.includes("primaria")) return "primaria";
  if (c.includes("secundaria")) return "secundaria";
  if (c.includes("egresad") || c.includes("promo")) return "egresados";
  if (c.includes("formal") && !c.includes("informal")) return "secundaria";
  return "primaria";
}

/** Logo de muestra: escudo para lo clásico, moderno para lo infantil o descontracturado. */
export function logoDemoDeCategoria(categoria: string | null | undefined): LogoDemo {
  const c = sinTildes(categoria ?? "");
  if (c.includes("informal")) return "logo-moderno.png";
  if (c.includes("formal")) return "logo-escudo-clasico.png";
  const nivel = nivelDemoDeCategoria(categoria);
  return nivel === "jardin" || nivel === "secundaria" ? "logo-moderno.png" : "logo-escudo-clasico.png";
}

/** Nena o nene, fijo para cada plantilla (así la miniatura y el 3D muestran lo mismo). */
export function varianteDemo(templateId: string): VarianteDemo {
  let h = 0;
  for (let i = 0; i < templateId.length; i++) h = (h * 31 + templateId.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? 1 : 2;
}

type Persona = { firstName: string; lastName: string };

type DatosDeNivel = {
  curso: string;
  colegio: string;
  /** [nena, nene] */
  alumnos: [Persona, Persona];
  companeros: Persona[];
};

const COMPANEROS: Persona[] = [
  { firstName: "Sofía", lastName: "Acosta" },
  { firstName: "Thiago", lastName: "Benítez" },
  { firstName: "Isabella", lastName: "Castro" },
  { firstName: "Lautaro", lastName: "Domínguez" },
  { firstName: "Martina", lastName: "Fernández" },
  { firstName: "Felipe", lastName: "Giménez" },
  { firstName: "Catalina", lastName: "Herrera" },
  { firstName: "Bautista", lastName: "Ibarra" },
  { firstName: "Olivia", lastName: "Juárez" },
  { firstName: "Santino", lastName: "López" },
  { firstName: "Mía", lastName: "Medina" },
  { firstName: "Juan Cruz", lastName: "Núñez" },
  { firstName: "Renata", lastName: "Ortiz" },
  { firstName: "Agustín", lastName: "Paz" },
  { firstName: "Victoria", lastName: "Quiroga" },
  { firstName: "Facundo", lastName: "Ríos" },
  { firstName: "Julieta", lastName: "Silva" },
  { firstName: "Ignacio", lastName: "Vega" },
];

const NIVELES: Record<NivelDemo, DatosDeNivel> = {
  jardin: {
    curso: "Sala de 5 Celeste",
    colegio: "Jardín Arco Iris",
    alumnos: [
      { firstName: "Emma", lastName: "Gómez" },
      { firstName: "Benjamín", lastName: "Álvarez" },
    ],
    companeros: COMPANEROS.slice(0, 14),
  },
  primaria: {
    curso: "3.º B",
    colegio: "Escuela Manuel Belgrano",
    alumnos: [
      { firstName: "Valentina", lastName: "Pérez" },
      { firstName: "Mateo", lastName: "Romero" },
    ],
    companeros: COMPANEROS.slice(0, 18),
  },
  secundaria: {
    curso: "4.º año A",
    colegio: "Colegio San Martín",
    alumnos: [
      { firstName: "Lucía", lastName: "Morales" },
      { firstName: "Tomás", lastName: "Sosa" },
    ],
    companeros: COMPANEROS.slice(2, 18),
  },
  egresados: {
    curso: "6.º año Promo 2026",
    colegio: "Instituto Nuestra Señora del Valle",
    alumnos: [
      { firstName: "Camila", lastName: "Torres" },
      { firstName: "Joaquín", lastName: "Ruiz" },
    ],
    companeros: COMPANEROS.slice(0, 18),
  },
};


const RELIGIOSOS: Record<Exclude<EventoDemo, null>, { nivel: NivelDemo; curso: string; colegio: string }> = {
  comunion: { nivel: "primaria", curso: "Primera Comunión 2026", colegio: "Parroquia Nuestra Señora de Luján" },
  confirmacion: { nivel: "secundaria", curso: "Confirmación 2026", colegio: "Parroquia San José" },
};

export type DemoDePlantilla = {
  nivel: NivelDemo;
  evento: EventoDemo;
  variante: VarianteDemo;
  /** Nombres de archivo dentro de `CARPETA_DEMO`, uno por ranura, más el logo. */
  archivos: Record<RanuraDemo, string> & { logo: LogoDemo };
  alumno: Persona;
  curso: string;
  colegio: string;
  companeros: Array<Persona & { isOwner: boolean }>;
};

function archivosDeRanuras(nivel: NivelDemo, evento: EventoDemo, variante: VarianteDemo): Record<RanuraDemo, string> {
  const general: Record<RanuraDemo, string> = {
    individual: `retrato-${nivel}-${variante}.jpg`,
    grupal: `grupal-${nivel}.jpg`,
    maestra: nivel === "jardin" ? "con-maestra-jardin.jpg" : "con-maestra-primaria.jpg",
    amigos: nivel === "jardin" ? "amigos-primaria.jpg" : `amigos-${nivel}.jpg`,
    extra: "libre-patio.jpg",
  };
  if (evento === "comunion") {
    return {
      ...general,
      individual: `comunion-retrato-${variante}.jpg`,
      grupal: "comunion-grupal.jpg",
      maestra: "comunion-con-catequista.jpg",
      extra: "comunion-detalle.jpg",
    };
  }
  if (evento === "confirmacion") {
    return { ...general, individual: "confirmacion-retrato.jpg", grupal: "confirmacion-grupal.jpg" };
  }
  return general;
}

export function demoDePlantilla(input: { templateId: string; meta: unknown }): DemoDePlantilla {
  const categoria = categoriaDeMeta(input.meta);
  const evento = eventoDemo(categoria, textoDeMeta(input.meta, "evento"));
  const religioso = evento ? RELIGIOSOS[evento] : null;
  const nivel = religioso?.nivel ?? nivelDemoDeCategoria(categoria);
  const variante = varianteDemo(input.templateId);
  const datos = NIVELES[nivel];
  const alumno = datos.alumnos[variante - 1];
  // El listado va por apellido, con el alumno en su lugar y marcado.
  const companeros = [...datos.companeros.map((p) => ({ ...p, isOwner: false })), { ...alumno, isOwner: true }].sort(
    (a, b) => a.lastName.localeCompare(b.lastName, "es") || a.firstName.localeCompare(b.firstName, "es"),
  );
  return {
    nivel,
    evento,
    variante,
    archivos: { ...archivosDeRanuras(nivel, evento, variante), logo: logoDemoDeCategoria(categoria) },
    alumno,
    curso: religioso?.curso ?? datos.curso,
    colegio: religioso?.colegio ?? datos.colegio,
    companeros,
  };
}

/** Dirección pública de un archivo de la demo, o null si no hay almacenamiento público configurado. */
export function urlDeDemo(basePublica: string | null | undefined, archivo: string): string | null {
  const base = basePublica?.trim().replace(/\/+$/, "");
  if (!base || !/^https?:\/\//.test(base)) return null;
  return `${base}/${CARPETA_DEMO}/${archivo}`;
}

export type BloqueDemo = { id: string; type: string; configJson?: unknown };
export type HuecoDemo = { blockId: string; variableKey: string; ranura: RanuraDemo };

function variableDeImagen(configJson: unknown): string | null {
  const c = configJson && typeof configJson === "object" && !Array.isArray(configJson) ? (configJson as Record<string, unknown>) : {};
  const s = c.source && typeof c.source === "object" ? (c.source as Record<string, unknown>) : {};
  const k = typeof s.variableKey === "string" ? s.variableKey : typeof c.variableKey === "string" ? c.variableKey : null;
  return k?.trim() || null;
}

/** Los huecos de foto de la plantilla con la ranura de cada uno (incluye maestra, amigos y libre). */
export function huecosDeDemo(blocks: BloqueDemo[]): HuecoDemo[] {
  const out: HuecoDemo[] = [];
  for (const b of blocks) {
    if (b.type !== "IMAGE" && b.type !== "PHOTO") continue;
    const variableKey = variableDeImagen(b.configJson);
    const ranura = ranuraDeVariable(variableKey);
    if (variableKey && ranura) out.push({ blockId: b.id, variableKey, ranura });
  }
  return out;
}

/** Los archivos que necesita la plantilla: uno por ranura usada, más el logo. Sin repetir. */
export function archivosNecesarios(demo: DemoDePlantilla, huecos: HuecoDemo[]): string[] {
  return [...new Set([...huecos.map((h) => demo.archivos[h.ranura]), demo.archivos.logo])].sort();
}

/** Foto de muestra para cuando la de la demo todavía no está: gris suave con una cámara. */
export const FOTO_DE_MUESTRA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="#e6e1da"/>
    <g fill="none" stroke="#b9afa3" stroke-width="18" stroke-linejoin="round">
      <rect x="170" y="215" width="260" height="180" rx="28"/>
      <path d="M245 215l20-38h70l20 38"/>
      <circle cx="300" cy="305" r="50"/>
    </g>
  </svg>`;

export const FOTO_DE_MUESTRA_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FOTO_DE_MUESTRA_SVG)}`;

/**
 * Sello para la clave de caché de la miniatura: dice cuáles de los archivos que usa la plantilla
 * estaban. Cuando se suben los que faltaban cambia el sello y la miniatura se vuelve a dibujar.
 */
export function selloDeDemo(hay: Record<string, boolean>): string {
  const firma = Object.keys(hay)
    .sort()
    .map((k) => `${k}:${hay[k] ? 1 : 0}`)
    .join("|");
  let h = 2166136261;
  for (let i = 0; i < firma.length; i++) h = Math.imul(h ^ firma.charCodeAt(i), 16777619) >>> 0;
  const presentes = Object.values(hay).filter(Boolean).length;
  return `${presentes}de${Object.keys(hay).length}-${h.toString(36)}`;
}

/**
 * La foto que va en cada hueco para la vista 3D: la de demo si está subida (su URL), si no la de
 * muestra. Indexado por blockId, como lo pide el renderer.
 */
export function fotosDeDemoPorBloque(
  huecos: HuecoDemo[],
  demo: DemoDePlantilla,
  urlSiEsta: (archivo: string) => string | null,
): Record<string, { src: string }> {
  const out: Record<string, { src: string }> = {};
  for (const h of huecos) out[h.blockId] = { src: urlSiEsta(demo.archivos[h.ranura]) ?? FOTO_DE_MUESTRA_DATA_URL };
  return out;
}
