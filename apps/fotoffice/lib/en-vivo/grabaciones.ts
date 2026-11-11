import type { EstadoVivo } from "./estados";
import { estaActivo } from "./estados";

/**
 * A qué vivo pertenece una grabación.
 *
 * Cloudflare graba todo lo que entra por el live input, haya o no un vivo creado en el panel.
 * El aviso de la grabación trae el live input y la hora en que se creó el video, no nuestro vivo.
 * Se elige el vivo de ese canal que estaba abierto en ese momento. Módulo PURO.
 */

export type SesionCandidata = {
  id: string;
  status: EstadoVivo;
  createdAt: Date;
  endedAt: Date | null;
};

/** Margen para relojes y para el rato entre «Nuevo vivo» y que OBS arranque. */
export const MARGEN_MS = 10 * 60 * 1000;

export function elegirSesionParaGrabacion(sesiones: SesionCandidata[], creado: Date | null): string | null {
  const ordenadas = [...sesiones].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (!creado) {
    // Sin hora: la abierta más reciente, si hay.
    return ordenadas.find((s) => estaActivo(s.status))?.id ?? null;
  }
  const t = creado.getTime();
  const enVentana = ordenadas.find((s) => {
    if (s.createdAt.getTime() - MARGEN_MS > t) return false;
    if (estaActivo(s.status)) return true;
    return s.endedAt !== null && s.endedAt.getTime() + MARGEN_MS >= t;
  });
  return enVentana?.id ?? null;
}

/** Título del vivo que se crea solo cuando OBS transmitió sin pasar por «Nuevo vivo». */
export function tituloImprovisado(at: Date): string {
  // Armado a mano con las partes: el formato de fecha de es-AR cambia según la versión de ICU
  // (con o sin cero adelante, con "p. m."), y el título tiene que ser siempre el mismo.
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return `Vivo del ${partes.day}/${partes.month}, ${partes.hour}:${partes.minute}`;
}

export function duracionLegible(segundos: number | null): string {
  if (!segundos || segundos <= 0) return "";
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${Math.max(1, m)} min`;
}
