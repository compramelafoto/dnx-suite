/**
 * Reglas de la selección del cliente (etapa 7). Módulo PURO: valida mínimo/máximo, la coherencia de la
 * configuración y las transiciones del estado de cada cliente. Los textos son para mostrar tal cual.
 */
import { MAX_COMENTARIO, type EstadoCliente, type ModoSeleccion } from "./constantes";

export type ConfigSeleccion = { selectionMode: ModoSeleccion; minSelect: number | null; maxSelect: number | null };

export const MENSAJES_SELECCION = {
  modoInvalido: "Elegí si la selección es libre o por cantidad.",
  libreSinLimites: "Una selección libre no lleva mínimo ni máximo.",
  cantidadSinLimites: "Poné un mínimo, un máximo o los dos.",
  limiteInvalido: "El mínimo y el máximo tienen que ser números enteros de 1 en adelante.",
  minMayorQueMax: "El mínimo no puede ser mayor que el máximo.",
  sinFotos: "Elegí al menos una foto antes de enviar.",
  comentarioVacio: "Escribí el comentario.",
  comentarioLargo: `El comentario puede tener hasta ${MAX_COMENTARIO.toLocaleString("es-AR")} caracteres.`,
} as const;

export function mensajeMinimo(min: number, actual: number): string {
  const faltan = min - actual;
  return `Tenés que elegir al menos ${min} ${min === 1 ? "foto" : "fotos"}: te ${faltan === 1 ? "falta 1" : `faltan ${faltan}`}.`;
}

export function mensajeMaximo(max: number, actual: number): string {
  const sobran = actual - max;
  return `Podés elegir hasta ${max} ${max === 1 ? "foto" : "fotos"}: te ${sobran === 1 ? "sobra 1" : `sobran ${sobran}`}.`;
}

export type MotivoEnvio = "SIN_FOTOS" | "MINIMO" | "MAXIMO";
export type ResultadoEnvio = { ok: true } | { ok: false; motivo: MotivoEnvio; error: string };

const esEntero1 = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1;

/** Misma regla que el CHECK `FotofficeGaleria_minMax` del SQL. */
export function validarConfigSeleccion(c: ConfigSeleccion): { ok: true } | { ok: false; error: string } {
  if (c.selectionMode === "LIBRE") {
    return c.minSelect === null && c.maxSelect === null ? { ok: true } : { ok: false, error: MENSAJES_SELECCION.libreSinLimites };
  }
  if (c.selectionMode !== "CANTIDAD") return { ok: false, error: MENSAJES_SELECCION.modoInvalido };
  if (c.minSelect === null && c.maxSelect === null) return { ok: false, error: MENSAJES_SELECCION.cantidadSinLimites };
  if ((c.minSelect !== null && !esEntero1(c.minSelect)) || (c.maxSelect !== null && !esEntero1(c.maxSelect))) {
    return { ok: false, error: MENSAJES_SELECCION.limiteInvalido };
  }
  if (c.minSelect !== null && c.maxSelect !== null && c.minSelect > c.maxSelect) {
    return { ok: false, error: MENSAJES_SELECCION.minMayorQueMax };
  }
  return { ok: true };
}

/**
 * ¿Se puede enviar esta cantidad de fotos? Siempre hace falta al menos una; en "por cantidad" se valida
 * el mínimo y el máximo.
 */
export function validarEnvio(config: ConfigSeleccion, cantidad: number): ResultadoEnvio {
  if (!Number.isInteger(cantidad) || cantidad < 1) return { ok: false, motivo: "SIN_FOTOS", error: MENSAJES_SELECCION.sinFotos };
  if (config.selectionMode === "CANTIDAD") {
    if (config.minSelect !== null && cantidad < config.minSelect) return { ok: false, motivo: "MINIMO", error: mensajeMinimo(config.minSelect, cantidad) };
    if (config.maxSelect !== null && cantidad > config.maxSelect) return { ok: false, motivo: "MAXIMO", error: mensajeMaximo(config.maxSelect, cantidad) };
  }
  return { ok: true };
}

/** ¿Cabe elegir `agregar` fotos más sobre las `actuales`? Sólo frena el máximo de "por cantidad". */
export function puedeAgregar(config: ConfigSeleccion, actuales: number, agregar = 1): { ok: true } | { ok: false; error: string } {
  if (config.selectionMode === "CANTIDAD" && config.maxSelect !== null && actuales + agregar > config.maxSelect) {
    return { ok: false, error: `Ya elegiste el máximo: ${config.maxSelect} ${config.maxSelect === 1 ? "foto" : "fotos"}.` };
  }
  return { ok: true };
}

/** Progreso para el contador de la barra fija: "12 de 20" o "12" y si ya alcanza el mínimo. */
export function progresoSeleccion(config: ConfigSeleccion, cantidad: number): { texto: string; cumpleMinimo: boolean; llegoAlMaximo: boolean } {
  const min = config.selectionMode === "CANTIDAD" ? config.minSelect : null;
  const max = config.selectionMode === "CANTIDAD" ? config.maxSelect : null;
  const texto = max !== null ? `${cantidad} de ${max}` : String(cantidad);
  return { texto, cumpleMinimo: min === null || cantidad >= min, llegoAlMaximo: max !== null && cantidad >= max };
}

// --- Estado de cada cliente -----------------------------------------------------------------------------

export type AccionCliente = "ENVIAR" | "FINALIZAR" | "REACTIVAR";

const TRANSICIONES: Record<AccionCliente, { desde: readonly EstadoCliente[]; hacia: EstadoCliente }> = {
  /** El cliente envía su selección (escritura condicional `EN_PROGRESO → EN_REVISION`). */
  ENVIAR: { desde: ["EN_PROGRESO"], hacia: "EN_REVISION" },
  /** El estudio cierra la selección ya revisada. */
  FINALIZAR: { desde: ["EN_REVISION"], hacia: "FINALIZADO" },
  /** El estudio le devuelve la selección al cliente para que siga eligiendo. */
  REACTIVAR: { desde: ["EN_REVISION", "FINALIZADO"], hacia: "EN_PROGRESO" },
};

/** Estados desde los que se puede aplicar la acción (para el `where` de la escritura condicional). */
export function estadosDesde(accion: AccionCliente): readonly EstadoCliente[] {
  return TRANSICIONES[accion].desde;
}

export function estadoDespues(accion: AccionCliente): EstadoCliente {
  return TRANSICIONES[accion].hacia;
}

/** El estado al que pasa el cliente con esa acción, o null si desde el actual no se puede. */
export function transicionar(actual: EstadoCliente, accion: AccionCliente): EstadoCliente | null {
  const t = TRANSICIONES[accion];
  return t.desde.includes(actual) ? t.hacia : null;
}

/** Sólo en `EN_PROGRESO` el cliente puede elegir, quitar y comentar. */
export function puedeEditarElCliente(estado: EstadoCliente): boolean {
  return estado === "EN_PROGRESO";
}

/** ¿El cliente está esperando que el estudio revise lo que mandó? */
export function esperaRevision(estado: EstadoCliente): boolean {
  return estado === "EN_REVISION";
}

// --- Comentarios -----------------------------------------------------------------------------------------

/** Texto del comentario listo para guardar, o el error. Normaliza los saltos de línea y recorta los bordes. */
export function validarComentario(raw: unknown): { ok: true; texto: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: MENSAJES_SELECCION.comentarioVacio };
  const texto = raw.replace(/\r\n?/g, "\n").trim();
  if (texto.length === 0) return { ok: false, error: MENSAJES_SELECCION.comentarioVacio };
  if (texto.length > MAX_COMENTARIO) return { ok: false, error: MENSAJES_SELECCION.comentarioLargo };
  return { ok: true, texto };
}
