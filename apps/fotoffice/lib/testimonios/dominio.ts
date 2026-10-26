/**
 * Reglas puras de los testimonios del sitio (PR 3). Sin base ni red: las usan el formulario público,
 * la invitación, el panel y la lectura pública. Cada texto que escribe el autor pasa por acá antes de
 * guardarse, y nada se publica sin su permiso (`puedePublicar`).
 */

import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";

export const ESTADOS_TESTIMONIO = ["PENDIENTE", "PUBLICADO", "RECHAZADO"] as const;
export type EstadoTestimonio = (typeof ESTADOS_TESTIMONIO)[number];

export const ORIGENES_TESTIMONIO = ["IMPORTADO", "FORMULARIO", "INVITACION", "CARGA_MANUAL"] as const;
export type OrigenTestimonio = (typeof ORIGENES_TESTIMONIO)[number];

export const MAX_TEXTO = 1200;
export const MAX_EXTRACTO = 240;
export const MAX_NOMBRE = 120;
export const MAX_DETALLE = 160;
export const MAX_ENLACE = 500;
export const MAX_CORREO = 254;
/** Pasado este largo, la tarjeta muestra el comienzo y «Leer más». */
export const LARGO_LEER_MAS = 400;

export type EntradaTestimonio = {
  texto?: unknown;
  extracto?: unknown;
  autorNombre?: unknown;
  autorDetalle?: unknown;
  autorEnlace?: unknown;
  autorEmail?: unknown;
  calificacion?: unknown;
};

export type DatosTestimonio = {
  texto: string;
  extracto: string | null;
  autorNombre: string;
  autorDetalle: string | null;
  autorEnlace: string | null;
  autorEmail: string | null;
  calificacion: number | null;
};

export type CampoTestimonio = keyof DatosTestimonio;

export type ResultadoValidacion =
  | { ok: true; datos: DatosTestimonio }
  | { ok: false; errores: Partial<Record<CampoTestimonio, string>> };

export const MENSAJES_TESTIMONIO = {
  texto: "Escribí tu testimonio.",
  textoLargo: `El testimonio puede tener hasta ${MAX_TEXTO.toLocaleString("es-AR")} caracteres.`,
  extractoLargo: `La frase destacada puede tener hasta ${MAX_EXTRACTO} caracteres.`,
  nombre: "Poné tu nombre.",
  nombreLargo: `El nombre puede tener hasta ${MAX_NOMBRE} caracteres.`,
  detalleLargo: `El detalle puede tener hasta ${MAX_DETALLE} caracteres.`,
  enlace: "Poné una dirección que empiece con https:// o tu usuario de Instagram con @.",
  correo: "Revisá el correo: no parece válido.",
  calificacion: "La calificación va de 1 a 5 estrellas.",
  sinPermiso: "Falta el permiso del autor para publicarlo.",
  sinTexto: "No se puede publicar un testimonio sin texto.",
  sinNombre: "No se puede publicar un testimonio sin el nombre de quien lo escribió.",
} as const;

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Una línea: sin saltos y con un solo espacio entre palabras. */
function linea(v: unknown): string {
  return texto(v).replace(/\s+/g, " ").trim();
}

/** Párrafos: saltos de línea normales y como mucho una línea en blanco seguida. */
function parrafos(v: unknown): string {
  return texto(v)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const USUARIO_INSTAGRAM = /^@([A-Za-z0-9._]{1,30})$/;

/**
 * El enlace del autor se publica como `href`: sólo `http` y `https`. Un `@usuario` se toma como su
 * Instagram. `undefined` = no es un enlace aceptable.
 */
export function normalizarEnlace(raw: unknown): string | null | undefined {
  const v = linea(raw);
  if (!v) return null;
  const ig = USUARIO_INSTAGRAM.exec(v);
  if (ig) return `https://instagram.com/${ig[1]}`;
  if (v.length > MAX_ENLACE) return undefined;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

const FORMA_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function calificacionDe(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : Number.NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
}

/** Valida y limpia lo que escribió el autor (o el estudio, en la carga manual). Un error por campo. */
export function validarTestimonio(input: EntradaTestimonio): ResultadoValidacion {
  const errores: Partial<Record<CampoTestimonio, string>> = {};

  const t = parrafos(input.texto);
  if (!t) errores.texto = MENSAJES_TESTIMONIO.texto;
  else if (t.length > MAX_TEXTO) errores.texto = MENSAJES_TESTIMONIO.textoLargo;

  const extracto = parrafos(input.extracto);
  if (extracto.length > MAX_EXTRACTO) errores.extracto = MENSAJES_TESTIMONIO.extractoLargo;

  const nombre = linea(input.autorNombre);
  if (!nombre) errores.autorNombre = MENSAJES_TESTIMONIO.nombre;
  else if (nombre.length > MAX_NOMBRE) errores.autorNombre = MENSAJES_TESTIMONIO.nombreLargo;

  const detalle = linea(input.autorDetalle);
  if (detalle.length > MAX_DETALLE) errores.autorDetalle = MENSAJES_TESTIMONIO.detalleLargo;

  const enlace = normalizarEnlace(input.autorEnlace);
  if (enlace === undefined) errores.autorEnlace = MENSAJES_TESTIMONIO.enlace;

  const correo = linea(input.autorEmail).toLowerCase();
  if (correo && (correo.length > MAX_CORREO || !FORMA_CORREO.test(correo))) errores.autorEmail = MENSAJES_TESTIMONIO.correo;

  const calificacion = calificacionDe(input.calificacion);
  if (calificacion === undefined) errores.calificacion = MENSAJES_TESTIMONIO.calificacion;

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return {
    ok: true,
    datos: {
      texto: t,
      extracto: extracto || null,
      autorNombre: nombre,
      autorDetalle: detalle || null,
      autorEnlace: enlace ?? null,
      autorEmail: correo || null,
      calificacion: calificacion ?? null,
    },
  };
}

/**
 * `null` si el testimonio se puede publicar; si no, el motivo para mostrar. La regla de oro: sin
 * permiso del autor nunca sale (en la carga manual, el dueño marca «tengo permiso del autor»).
 */
export function puedePublicar(t: { consentimiento: boolean; texto: string; autorNombre: string }): string | null {
  if (!t.consentimiento) return MENSAJES_TESTIMONIO.sinPermiso;
  if (!t.texto.trim()) return MENSAJES_TESTIMONIO.sinTexto;
  if (!t.autorNombre.trim()) return MENSAJES_TESTIMONIO.sinNombre;
  return null;
}

/**
 * Orden para el sitio: los destacados primero y en el orden recibido; el resto, mezclado si se pide
 * (Fisher-Yates con `azar`), así la portada no muestra siempre los mismos. No toca la lista recibida.
 */
export function ordenarParaPublico<T extends { destacado: boolean }>(filas: readonly T[], barajar: boolean, azar: () => number = Math.random): T[] {
  const destacados = filas.filter((f) => f.destacado);
  const resto = filas.filter((f) => !f.destacado);
  if (barajar) {
    for (let i = resto.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [resto[i], resto[j]] = [resto[j]!, resto[i]!];
    }
  }
  return [...destacados, ...resto];
}

/** Las tablas de Testimonios se crean a mano: mientras no existan, Prisma tira P2021 y el sitio muestra vacío. */
export function esTablaFaltante(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

/** El permiso que acepta el autor en el formulario: se guarda tal cual, con el nombre del estudio. */
export function textoConsentimiento(estudio: string): string {
  return `Acepto que ${estudio.trim() || "el estudio"} publique mi testimonio con mi nombre y foto en su sitio web.`;
}

/** Foto del autor: JPG, PNG o WebP de hasta 5 MB; el navegador la achica antes a 800 px de lado. */
export const FORMATOS_FOTO_AUTOR = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BYTES_FOTO_AUTOR = 5 * 1024 * 1024;
export const LADO_MAX_FOTO_AUTOR = 800;

/** Prefijo de R2 de las fotos de autores de un workspace. Lo arma el servidor, nunca el navegador. */
export function prefijoFotoAutor(workspaceId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.siteTestimonioPhoto}/${workspaceId}/`;
}

/** ¿La key es una foto de autor de ESTE workspace? (sin `..` ni barras raras). */
export function esKeyFotoAutor(workspaceId: string, key: unknown): key is string {
  if (typeof key !== "string" || key.length > 300) return false;
  const prefijo = prefijoFotoAutor(workspaceId);
  return key.startsWith(prefijo) && /^[A-Za-z0-9._-]+$/.test(key.slice(prefijo.length));
}

/**
 * La foto del autor que se puede mostrar en el sitio: una dirección del bucket público de FOTOFFICE
 * (`baseR2`, con o sin barra final) o una ruta propia (`/algo`, nunca `//otro-sitio`). Cualquier otra
 * (un sitio ajeno que podría rastrear a quien mira) se descarta y la tarjeta muestra las iniciales.
 */
export function fotoAutorMostrable(url: string | null | undefined, baseR2: string | null): string | null {
  if (typeof url !== "string" || !url) return null;
  if (/^\/(?![\/\\])/.test(url)) return url;
  const base = baseR2?.replace(/\/+$/, "");
  if (base && /^https:\/\//i.test(base) && url.startsWith(`${base}/`) && !url.includes("..")) return url;
  return null;
}
