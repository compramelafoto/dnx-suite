/**
 * Constantes de la Galería (etapa 7, Entrega A1: selección). Módulo PURO: sin base ni red.
 * Los valores de texto tienen su CHECK en `20261101120000_fotoffice_etapa_7_galeria`.
 */

export const MODOS_VENTA = ["SELECCION", "SELECCION_Y_VENTA", "VENTA"] as const;
export type ModoVenta = (typeof MODOS_VENTA)[number];
export const esModoVenta = (v: unknown): v is ModoVenta => typeof v === "string" && (MODOS_VENTA as readonly string[]).includes(v);

export const TIPOS_GALERIA = ["SELECCION", "ENTREGA", "ALBUM"] as const;
export type TipoGaleria = (typeof TIPOS_GALERIA)[number];
/** El tipo de una galería según su `kind` en la base: lo desconocido se lee como SELECCION. */
export function tipoDeKind(kind: unknown): TipoGaleria {
  return kind === "ENTREGA" ? "ENTREGA" : kind === "ALBUM" ? "ALBUM" : "SELECCION";
}

export const MODOS_SELECCION = ["LIBRE", "CANTIDAD"] as const;
export type ModoSeleccion = (typeof MODOS_SELECCION)[number];

export const MODOS_DESCARGA = ["NINGUNA", "VISTA", "SELECCIONADAS"] as const;
export type ModoDescarga = (typeof MODOS_DESCARGA)[number];

export const ESTADOS_GALERIA = ["BORRADOR", "PUBLICADA", "ARCHIVADA"] as const;
export type EstadoGaleria = (typeof ESTADOS_GALERIA)[number];
export const esEstadoGaleria = (v: unknown): v is EstadoGaleria => typeof v === "string" && (ESTADOS_GALERIA as readonly string[]).includes(v);

export const MODOS_ORDEN = ["NOMBRE", "MANUAL"] as const;
export type ModoOrden = (typeof MODOS_ORDEN)[number];

export const ESTADOS_FOTO = ["PENDIENTE", "LISTA", "ERROR"] as const;
export type EstadoFoto = (typeof ESTADOS_FOTO)[number];

export const ESTADOS_CLIENTE = ["EN_PROGRESO", "EN_REVISION", "FINALIZADO"] as const;
export type EstadoCliente = (typeof ESTADOS_CLIENTE)[number];

export const AUTORES_COMENTARIO = ["CLIENTE", "ESTUDIO"] as const;
export type AutorComentario = (typeof AUTORES_COMENTARIO)[number];

export const ETIQUETA_ESTADO_GALERIA: Record<EstadoGaleria, string> = {
  BORRADOR: "Borrador",
  PUBLICADA: "Publicada",
  ARCHIVADA: "Archivada",
};
export const ETIQUETA_TIPO_GALERIA: Record<TipoGaleria, string> = {
  SELECCION: "Selección",
  ENTREGA: "Entrega",
  ALBUM: "Álbum",
};
export const esTipoGaleria = (v: unknown): v is TipoGaleria => typeof v === "string" && (TIPOS_GALERIA as readonly string[]).includes(v);
export const ETIQUETA_ESTADO_CLIENTE: Record<EstadoCliente, string> = {
  EN_PROGRESO: "Eligiendo",
  EN_REVISION: "Esperando tu revisión",
  FINALIZADO: "Finalizada",
};
export const ETIQUETA_MODO_SELECCION: Record<ModoSeleccion, string> = {
  LIBRE: "Libre",
  CANTIDAD: "Por cantidad",
};
export const ETIQUETA_MODO_DESCARGA: Record<ModoDescarga, string> = {
  NINGUNA: "Sin descarga",
  VISTA: "Vista de galería",
  SELECCIONADAS: "Sólo las fotos elegidas o compradas, en alta",
};

// --- Topes ------------------------------------------------------------------------------------------

/** Fotos por galería. */
export const MAX_FOTOS_POR_GALERIA = 3000;
/** Clientes (enlaces) por galería. */
export const MAX_CLIENTES_POR_GALERIA = 30;
/** Comentarios de un cliente en una galería (los suyos). */
export const MAX_COMENTARIOS_POR_CLIENTE = 300;
/** Largo de un comentario. */
export const MAX_COMENTARIO = 2000;
export const MAX_NOMBRE_GALERIA = 120;
export const MAX_MENSAJE_GALERIA = 2000;
export const MAX_MENSAJE_ENVIO = 2000;
/** Fotos que se piden firmar o procesan en una misma llamada. */
export const MAX_LOTE_FOTOS = 100;

// --- Álbum por rondas (Entrega C) ----------------------------------------------------------------------

export const ESTADOS_RONDA = ["ABIERTA", "CERRADA"] as const;
export type EstadoRonda = (typeof ESTADOS_RONDA)[number];
export const DECISIONES_ALBUM = ["APROBADO", "CAMBIOS"] as const;
export type DecisionAlbum = (typeof DECISIONES_ALBUM)[number];
export const ETIQUETA_DECISION_ALBUM: Record<DecisionAlbum, string> = { APROBADO: "Aprobó el álbum", CAMBIOS: "Pidió cambios" };
/** Láminas por ronda. */
export const MAX_LAMINAS_POR_RONDA = 300;
/** Largo de la nota del estudio al abrir una ronda y del mensaje de una decisión. */
export const MAX_NOTA_RONDA = 2000;
/** Comentarios de un cliente en una ronda de álbum. */
export const MAX_COMENTARIOS_POR_RONDA = 300;

// --- Fotos y almacenamiento --------------------------------------------------------------------------

/** 50 MB exactos por original. */
export const TAMANO_MAXIMO_ORIGINAL = 52_428_800;
export const TIPOS_FOTO_PERMITIDOS = ["image/jpeg", "image/png"] as const;
export type TipoFotoPermitido = (typeof TIPOS_FOTO_PERMITIDOS)[number];
/** Lado mayor de la vista de galería (sin agrandar) y calidad JPEG. */
export const LADO_VISTA = 2048;
export const CALIDAD_VISTA = 82;
/** Lado mayor de la miniatura y calidad JPEG. */
export const LADO_MINIATURA = 480;
export const CALIDAD_MINIATURA = 75;
/** Vida de la URL firmada de subida (PUT) y de las de lectura (GET). */
export const SEGUNDOS_SUBIDA_FOTO = 15 * 60;
export const SEGUNDOS_LECTURA_FOTO = 60 * 60;
/** Vigencia del enlace firmado para bajar un original. */
export const SEGUNDOS_DESCARGA_ORIGINAL = 5 * 60;
/** Intentos de procesamiento antes de dejar la foto en ERROR para siempre. */
export const MAX_INTENTOS_FOTO = 3;
/** Una foto PENDIENTE sin objeto subido pasado este plazo se limpia. */
export const HORAS_PENDIENTE_FOTO = 24;

export function esTipoFotoPermitido(v: unknown): v is TipoFotoPermitido {
  return typeof v === "string" && (TIPOS_FOTO_PERMITIDOS as readonly string[]).includes(v);
}

// --- Videos (Entrega B) -------------------------------------------------------------------------------

export const TIPOS_MEDIO = ["FOTO", "VIDEO"] as const;
export type TipoMedio = (typeof TIPOS_MEDIO)[number];
export const esTipoMedio = (v: unknown): v is TipoMedio => typeof v === "string" && (TIPOS_MEDIO as readonly string[]).includes(v);

/** 5 GB (decimales) por video: una sola URL firmada PUT; R2 admite un poco menos de 5 GiB en un PUT simple. */
export const TAMANO_MAXIMO_VIDEO = 5_000_000_000;
export const TIPOS_VIDEO_PERMITIDOS = ["video/mp4", "video/quicktime"] as const;
export type TipoVideoPermitido = (typeof TIPOS_VIDEO_PERMITIDOS)[number];
/** Videos por galería de entrega. */
export const MAX_VIDEOS_POR_GALERIA = 200;
/** Vida de la URL firmada de subida de un video: un archivo de varios GB tarda. */
export const SEGUNDOS_SUBIDA_VIDEO = 60 * 60;

export function esTipoVideoPermitido(v: unknown): v is TipoVideoPermitido {
  return typeof v === "string" && (TIPOS_VIDEO_PERMITIDOS as readonly string[]).includes(v);
}

/** FOTO o VIDEO según el tipo MIME declarado; null si no es ninguno de los permitidos. */
export function medioDeTipo(tipo: unknown): TipoMedio | null {
  if (esTipoFotoPermitido(tipo)) return "FOTO";
  if (esTipoVideoPermitido(tipo)) return "VIDEO";
  return null;
}

/** Tamaño máximo de un original según su tipo de medio. */
export function tamanoMaximoDe(medio: TipoMedio): number {
  return medio === "VIDEO" ? TAMANO_MAXIMO_VIDEO : TAMANO_MAXIMO_ORIGINAL;
}
