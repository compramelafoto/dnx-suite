/**
 * Formatos y textos de la ficha que comparten el servidor y la pantalla. Módulo PURO: sin
 * base de datos ni `server-only`, así lo importan los componentes de cliente.
 */
import type { TipoEvento } from "./linea-de-tiempo";

const ZONA = "America/Argentina/Buenos_Aires";

const fechaHoraAR = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fechaAR = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });

function aFecha(v: string | Date): Date | null {
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "29/09/2026 14:05", en hora de Buenos Aires sin importar dónde corra. */
export function fechaHoraBA(v: string | Date): string {
  const d = aFecha(v);
  return d ? fechaHoraAR.format(d).replace(",", "") : "";
}

/** "29/09/2026", en hora de Buenos Aires. */
export function fechaBA(v: string | Date): string {
  const d = aFecha(v);
  return d ? fechaAR.format(d) : "";
}

/** Tamaño de archivo legible: "820 KB", "1,5 MB". */
export function tamanoLegible(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// ─── Etiquetas ───────────────────────────────────────────────────────────────

const CLASES_COLOR: Record<string, string> = {
  gris: "bg-gray-100 text-gray-700",
  rojo: "bg-red-100 text-red-700",
  naranja: "bg-orange-100 text-orange-700",
  amarillo: "bg-yellow-100 text-yellow-800",
  verde: "bg-green-100 text-green-700",
  azul: "bg-blue-100 text-blue-700",
  violeta: "bg-violet-100 text-violet-700",
  rosa: "bg-pink-100 text-pink-700",
};

/** Clases de Tailwind del chip de una etiqueta; un color desconocido se ve gris. */
export function claseDeColorEtiqueta(color: string): string {
  return CLASES_COLOR[color] ?? CLASES_COLOR.gris!;
}

export const NOMBRES_DE_COLOR: Record<string, string> = {
  gris: "Gris",
  rojo: "Rojo",
  naranja: "Naranja",
  amarillo: "Amarillo",
  verde: "Verde",
  azul: "Azul",
  violeta: "Violeta",
  rosa: "Rosa",
};

// ─── Línea de tiempo ─────────────────────────────────────────────────────────

export const NOMBRES_DE_FILTRO: Record<TipoEvento, string> = {
  notas: "Notas",
  cambios: "Cambios",
  plata: "Plata",
  portal: "Portal",
  carnets: "Carnets",
  adjuntos: "Adjuntos",
};

/** Los filtros que se ofrecen: "Plata" sólo a quien puede ver dinero. */
export function filtrosVisibles(veDinero: boolean): { valor: TipoEvento | null; texto: string }[] {
  const tipos: TipoEvento[] = ["notas", "cambios", "plata", "portal", "carnets", "adjuntos"];
  return [
    { valor: null, texto: "Todo" },
    ...tipos.filter((t) => veDinero || t !== "plata").map((t) => ({ valor: t, texto: NOMBRES_DE_FILTRO[t] })),
  ];
}

// ─── Adjuntos ────────────────────────────────────────────────────────────────

const TIPO_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * El tipo que declara el navegador, o el que corresponde a la extensión cuando no declara
 * ninguno (pasa con HEIC en varios navegadores). El mismo valor se usa al pedir el permiso y
 * en el encabezado del PUT: tienen que coincidir con la firma.
 */
export function tipoDeArchivo(nombre: string, tipoDeclarado: string): string {
  if (tipoDeclarado) return tipoDeclarado;
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return TIPO_POR_EXTENSION[ext] ?? "";
}
