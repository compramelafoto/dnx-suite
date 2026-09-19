/**
 * La conversación con el servidor para vaciar la cola sin conexión.
 *
 * Vive separada del componente y recibe las dos llamadas como parámetros, así
 * se puede probar el caso que importa —qué pasa cuando el servidor contesta a
 * medias— sin navegador, sin base y sin cortar el wifi de verdad.
 */

import {
  aplicarResultadosDeSincronizacion,
  marcarEnviada,
  type EntradaOffline,
  type ResultadoSincronizacion,
} from "./offline-queue";

export type RespuestaEnvio =
  | { ok: true; id: string; syncStatus?: string }
  | { ok: false; motivo: string };

export type RespuestaProceso =
  | { ok: true; resultados: ResultadoSincronizacion[] }
  | { ok: false; motivo: string };

export type Transporte = {
  /** Sube un evento al servidor. */
  enviar: (entrada: EntradaOffline) => Promise<RespuestaEnvio>;
  /** Le pide al servidor que procese lo acumulado. */
  procesar: () => Promise<RespuestaProceso>;
};

export type ResultadoDeVaciado = {
  cola: EntradaOffline[];
  /** Mensaje para el operador, o null si salió todo bien. */
  mensaje: string | null;
};

/**
 * Sube lo pendiente y aplica lo que el servidor resolvió.
 *
 * Un evento que el servidor rechaza al recibirlo (por ejemplo, con el modo sin
 * conexión apagado) queda marcado y no se reintenta para siempre; uno que falla
 * por red sigue pendiente para el próximo intento.
 */
export async function vaciarCola(
  cola: EntradaOffline[],
  transporte: Transporte,
): Promise<ResultadoDeVaciado> {
  let actual = cola;
  const pendientes = actual.filter((e) => e.estado === "PENDIENTE");
  if (pendientes.length === 0) return { cola: actual, mensaje: null };

  for (const entrada of pendientes) {
    if (entrada.eventoServidorId) continue;
    const respuesta = await transporte.enviar(entrada);
    if (!respuesta.ok) {
      actual = actual.map((e) =>
        e.idempotencyKey === entrada.idempotencyKey
          ? { ...e, estado: "RECHAZADA" as const, motivo: respuesta.motivo }
          : e,
      );
      continue;
    }
    actual = marcarEnviada(actual, entrada.idempotencyKey, respuesta.id);
  }

  const proceso = await transporte.procesar();
  if (!proceso.ok) {
    return { cola: actual, mensaje: proceso.motivo };
  }
  return {
    cola: aplicarResultadosDeSincronizacion(actual, proceso.resultados),
    mensaje: null,
  };
}
