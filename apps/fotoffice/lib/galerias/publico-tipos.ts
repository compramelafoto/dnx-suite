/**
 * Tipos y reglas PURAS de la página del cliente (etapa 7): lo que viaja del servidor al navegador y los
 * cálculos que ambos lados comparten (filtros, textos). Sin base, sin red, sin `server-only`.
 */
import type { EstadoCliente, ModoSeleccion } from "./constantes";

/** Largo máximo del mensaje que el cliente le deja al estudio al enviar. */
export const MAX_MENSAJE_CLIENTE = 1000;
/** Fotos cuya vista grande se pide de una vez al abrir el visor. */
export const MAX_VISTAS_POR_LOTE = 12;

export const MENSAJES_PUBLICO = {
  enlaceInvalido: "Este enlace ya no es válido.",
  soloLectura: "Tu selección ya fue enviada, así que no se puede cambiar. Si querés modificar algo, escribinos.",
  yaEnviada: "Tu selección ya fue enviada.",
  fotoInvalida: "No encontramos esa foto.",
  sinComentarios: "En esta galería no se pueden dejar comentarios.",
  topeComentarios: "Llegaste al máximo de comentarios que se pueden dejar en esta galería.",
  mensajeLargo: `El mensaje puede tener hasta ${MAX_MENSAJE_CLIENTE.toLocaleString("es-AR")} caracteres.`,
  sinDescarga: "En esta galería no se pueden descargar las fotos.",
  demasiados: "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.",
  generico: "No pudimos hacerlo. Probá de nuevo en un momento.",
} as const;

export type FotoPublica = {
  id: string;
  /** Miniatura firmada (1 h); null si no se pudo firmar. */
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
};

export type ComentarioPublico = {
  id: string;
  fotoId: string;
  autor: "CLIENTE" | "ESTUDIO";
  texto: string;
  /** Ya en hora argentina, listo para mostrar. */
  fecha: string;
};

export type VistaGaleria = {
  organizacion: { nombre: string; logoUrl: string | null };
  galeria: {
    nombre: string;
    mensaje: string | null;
    permiteComentarios: boolean;
    permiteDescarga: boolean;
    modo: ModoSeleccion;
    minimo: number | null;
    maximo: number | null;
  };
  cliente: {
    nombre: string;
    estado: EstadoCliente;
    /** Cuándo envió, en hora argentina. */
    enviadaEn: string | null;
    mensajeEnviado: string | null;
  };
  portadaUrl: string | null;
  fotos: FotoPublica[];
  seleccionadas: string[];
  comentarios: ComentarioPublico[];
};

export type FiltroGaleria = "TODAS" | "SELECCIONADAS" | "CON_COMENTARIOS";

/** Las fotos que muestra la grilla según el filtro. Conserva el orden. */
export function filtrarFotos<T extends { id: string }>(
  fotos: readonly T[],
  filtro: FiltroGaleria,
  seleccionadas: ReadonlySet<string>,
  fotosConComentarios: ReadonlySet<string>,
): T[] {
  if (filtro === "SELECCIONADAS") return fotos.filter((f) => seleccionadas.has(f.id));
  if (filtro === "CON_COMENTARIOS") return fotos.filter((f) => fotosConComentarios.has(f.id));
  return [...fotos];
}

/** Ids de fotos con al menos un comentario. */
export function fotosConComentarios(comentarios: readonly { fotoId: string }[]): Set<string> {
  return new Set(comentarios.map((c) => c.fotoId));
}

/** Agrupa los comentarios por foto, en el orden en que vienen. */
export function comentariosPorFoto<T extends { fotoId: string }>(comentarios: readonly T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const c of comentarios) {
    const l = m.get(c.fotoId);
    if (l) l.push(c);
    else m.set(c.fotoId, [c]);
  }
  return m;
}

/** Ids cuya vista conviene tener lista al mirar la foto `indice` (la actual, un par antes y unas más adelante). */
export function idsParaPrecargar(ids: readonly string[], indice: number, atras = 2, adelante = 4): string[] {
  const desde = Math.max(0, indice - atras);
  const hasta = Math.min(ids.length - 1, indice + adelante);
  const salida: string[] = [];
  // La actual primero, después las siguientes y al final las anteriores.
  if (indice >= 0 && indice < ids.length) salida.push(ids[indice]);
  for (let i = indice + 1; i <= hasta; i++) salida.push(ids[i]);
  for (let i = indice - 1; i >= desde; i--) salida.push(ids[i]);
  return salida;
}

/** Nombre del archivo que se baja: el de la foto sin extensión + .jpg, sólo con caracteres seguros. */
export function nombreDeDescarga(fileName: string): { ascii: string; utf8: string } {
  const base = fileName.replace(/\.[^./\\]{1,6}$/, "").replace(/[\\/\r\n"';:*?<>|%\u0000-\u001f]/g, "_").trim().slice(0, 120) || "foto";
  const ascii = base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_");
  return { ascii: `${ascii}.jpg`, utf8: `${base}.jpg` };
}
