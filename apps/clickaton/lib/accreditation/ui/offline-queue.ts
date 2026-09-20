/**
 * Cola de acreditaciones tomadas sin conexión.
 *
 * En la puerta de la sede el wifi se cae, y hasta acá un escaneo sin señal se
 * perdía: el fetch fallaba y el participante quedaba sin acreditar. Estas
 * funciones guardan el escaneo en el propio celular y lo vuelven a intentar
 * cuando hay señal, sin acreditar dos veces a nadie (cada escaneo viaja con una
 * clave de idempotencia que el servidor ya respeta).
 *
 * Todo lo que decide qué pasa con la cola es una función pura: el componente
 * sólo lee, guarda y dibuja.
 */

export type EstadoEntrada = "PENDIENTE" | "SINCRONIZADA" | "CONFLICTO" | "RECHAZADA";

export type EntradaOffline = {
  /** Clave única del escaneo. El servidor la usa para no duplicar el check-in. */
  idempotencyKey: string;
  /** Cuándo se escaneó en la puerta, no cuándo se sincronizó. */
  clientOccurredAt: string;
  /** Token QR leído, si el escaneo fue por cámara o pegado. */
  qr: string | null;
  /** Número de participante tipeado a mano, cuando la cámara no anda. */
  shortCode: string | null;
  /** Inscripción ya identificada, cuando la caída fue al confirmar. */
  registrationIdHint: string | null;
  /** Lo que ve el operador en la lista de pendientes. */
  etiqueta: string;
  /** Aparato que tomó el escaneo, para la auditoría. */
  deviceId: string | null;
  estado: EstadoEntrada;
  /** Motivo del conflicto o rechazo que devolvió el servidor. */
  motivo: string | null;
  /** Id que devolvió el servidor al recibir el evento. */
  eventoServidorId: string | null;
};

export type ResultadoSincronizacion = {
  id: string;
  syncStatus: string;
  reason?: string;
};

/** Lo mínimo de localStorage que necesitamos; así se puede probar sin navegador. */
export type AlmacenLocal = {
  getItem: (clave: string) => string | null;
  setItem: (clave: string, valor: string) => void;
  removeItem: (clave: string) => void;
};

const PREFIJO_COLA = "clickaton.acreditacion.cola.";
const PREFIJO_APARATO = "clickaton.acreditacion.aparato.";

const ESTADOS: EstadoEntrada[] = ["PENDIENTE", "SINCRONIZADA", "CONFLICTO", "RECHAZADA"];

export function nuevaEntrada(input: {
  qr: string | null;
  shortCode?: string | null;
  registrationIdHint: string | null;
  etiqueta: string;
  deviceId: string | null;
  ahora: Date;
  clave: string;
}): EntradaOffline {
  return {
    idempotencyKey: input.clave,
    clientOccurredAt: input.ahora.toISOString(),
    qr: input.qr,
    shortCode: input.shortCode ?? null,
    registrationIdHint: input.registrationIdHint,
    etiqueta: input.etiqueta,
    deviceId: input.deviceId,
    estado: "PENDIENTE",
    motivo: null,
    eventoServidorId: null,
  };
}

/**
 * Agrega un escaneo a la cola, salvo que ese mismo participante ya esté
 * esperando. En la puerta el mismo QR se lee varias veces por segundo: sin este
 * filtro la cola se llenaría de repetidos y la lista sería ilegible.
 */
export function agregarPendiente(
  cola: EntradaOffline[],
  entrada: EntradaOffline,
): { cola: EntradaOffline[]; agregada: boolean } {
  const yaEsta = cola.some(
    (e) =>
      e.estado === "PENDIENTE" &&
      ((entrada.qr != null && e.qr === entrada.qr) ||
        (entrada.shortCode != null && e.shortCode === entrada.shortCode) ||
        (entrada.registrationIdHint != null &&
          e.registrationIdHint === entrada.registrationIdHint)),
  );
  if (yaEsta) return { cola, agregada: false };
  return { cola: [...cola, entrada], agregada: true };
}

/** Anota el id que devolvió el servidor al recibir el evento. Sigue pendiente. */
export function marcarEnviada(
  cola: EntradaOffline[],
  idempotencyKey: string,
  eventoServidorId: string,
): EntradaOffline[] {
  return cola.map((e) =>
    e.idempotencyKey === idempotencyKey ? { ...e, eventoServidorId } : e,
  );
}

function estadoDesdeServidor(syncStatus: string): EstadoEntrada {
  if (syncStatus === "SYNCED") return "SINCRONIZADA";
  if (syncStatus === "CONFLICT") return "CONFLICTO";
  if (syncStatus === "REJECTED") return "RECHAZADA";
  return "PENDIENTE";
}

/**
 * Aplica lo que contestó el servidor. Sólo toca las entradas de este aparato:
 * la sincronización procesa la cola de toda la edición, así que vuelven
 * resultados de escaneos que tomó otro celular.
 */
export function aplicarResultadosDeSincronizacion(
  cola: EntradaOffline[],
  resultados: ResultadoSincronizacion[],
): EntradaOffline[] {
  const porId = new Map(resultados.map((r) => [r.id, r]));
  return cola.map((e) => {
    const r = e.eventoServidorId ? porId.get(e.eventoServidorId) : undefined;
    if (!r) return e;
    return {
      ...e,
      estado: estadoDesdeServidor(r.syncStatus),
      motivo: r.reason ?? null,
    };
  });
}

/**
 * Mete el resultado de una sincronización en la cola que hay ahora.
 *
 * Sincronizar tarda, y mientras tanto el operador sigue escaneando. Si al
 * terminar se reemplazara la cola entera por la foto vieja, esos escaneos
 * nuevos se perderían: acá se actualizan sólo las entradas que ya existían y
 * se respeta lo que se haya agregado o quitado en el medio.
 */
export function fusionarActualizaciones(
  actual: EntradaOffline[],
  actualizadas: EntradaOffline[],
): EntradaOffline[] {
  const porClave = new Map(actualizadas.map((e) => [e.idempotencyKey, e]));
  return actual.map((e) => porClave.get(e.idempotencyKey) ?? e);
}

/** Cuántas acreditaciones todavía no cerraron bien. Es el número del cartel. */
export function contarSinResolver(cola: EntradaOffline[]): number {
  return cola.filter((e) => e.estado !== "SINCRONIZADA").length;
}

export function resumenDeCola(cola: EntradaOffline[]) {
  return {
    pendientes: cola.filter((e) => e.estado === "PENDIENTE").length,
    sincronizadas: cola.filter((e) => e.estado === "SINCRONIZADA").length,
    conflictos: cola.filter((e) => e.estado === "CONFLICTO").length,
    rechazadas: cola.filter((e) => e.estado === "RECHAZADA").length,
  };
}

/** Saca las que ya entraron bien; conflictos y rechazos quedan a la vista. */
export function purgarSincronizadas(cola: EntradaOffline[]): EntradaOffline[] {
  return cola.filter((e) => e.estado !== "SINCRONIZADA");
}

export function quitarEntrada(
  cola: EntradaOffline[],
  idempotencyKey: string,
): EntradaOffline[] {
  return cola.filter((e) => e.idempotencyKey !== idempotencyKey);
}

function esEntradaValida(valor: unknown): valor is EntradaOffline {
  if (typeof valor !== "object" || valor === null) return false;
  const e = valor as Record<string, unknown>;
  return (
    typeof e.idempotencyKey === "string" &&
    e.idempotencyKey.length > 0 &&
    typeof e.clientOccurredAt === "string"
  );
}

function normalizar(valor: Record<string, unknown>): EntradaOffline {
  const estado = valor.estado;
  return {
    idempotencyKey: String(valor.idempotencyKey),
    clientOccurredAt: String(valor.clientOccurredAt),
    qr: typeof valor.qr === "string" ? valor.qr : null,
    shortCode: typeof valor.shortCode === "string" ? valor.shortCode : null,
    registrationIdHint:
      typeof valor.registrationIdHint === "string" ? valor.registrationIdHint : null,
    etiqueta: typeof valor.etiqueta === "string" ? valor.etiqueta : "Escaneo sin conexión",
    deviceId: typeof valor.deviceId === "string" ? valor.deviceId : null,
    estado: ESTADOS.includes(estado as EstadoEntrada)
      ? (estado as EstadoEntrada)
      : "PENDIENTE",
    motivo: typeof valor.motivo === "string" ? valor.motivo : null,
    eventoServidorId:
      typeof valor.eventoServidorId === "string" ? valor.eventoServidorId : null,
  };
}

function almacenPorDefecto(): AlmacenLocal | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // Safari en navegación privada tira al sólo tocar localStorage.
    return null;
  }
}

/** Lee la cola guardada. Ante cualquier daño devuelve vacío: nunca lanza. */
export function leerCola(editionId: string, almacen?: AlmacenLocal | null): EntradaOffline[] {
  const store = almacen ?? almacenPorDefecto();
  if (!store) return [];
  try {
    const crudo = store.getItem(PREFIJO_COLA + editionId);
    if (!crudo) return [];
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos
      .filter(esEntradaValida)
      .map((e) => normalizar(e as unknown as Record<string, unknown>));
  } catch {
    return [];
  }
}

/** Guarda la cola. Si el almacenamiento está lleno o bloqueado, sigue de largo. */
export function guardarCola(
  editionId: string,
  cola: EntradaOffline[],
  almacen?: AlmacenLocal | null,
): void {
  const store = almacen ?? almacenPorDefecto();
  if (!store) return;
  try {
    store.setItem(PREFIJO_COLA + editionId, JSON.stringify(cola));
  } catch {
    // Perder el respaldo es malo, pero cortar la acreditación es peor.
  }
}

export function leerAparato(editionId: string, almacen?: AlmacenLocal | null): string | null {
  const store = almacen ?? almacenPorDefecto();
  if (!store) return null;
  try {
    return store.getItem(PREFIJO_APARATO + editionId);
  } catch {
    return null;
  }
}

export function guardarAparato(
  editionId: string,
  deviceId: string | null,
  almacen?: AlmacenLocal | null,
): void {
  const store = almacen ?? almacenPorDefecto();
  if (!store) return;
  try {
    if (deviceId) store.setItem(PREFIJO_APARATO + editionId, deviceId);
    else store.removeItem(PREFIJO_APARATO + editionId);
  } catch {
    // Sin memoria del aparato se sigue acreditando, sólo sin trazabilidad.
  }
}

/**
 * Distingue "se cayó la red" de "el servidor dijo que no".
 *
 * Importa: ante falta de red guardamos el escaneo, pero ante un rechazo real
 * (pago pendiente, QR inválido) guardarlo sería esconder el problema.
 */
export function esFalloDeConexion(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;
  return false;
}
