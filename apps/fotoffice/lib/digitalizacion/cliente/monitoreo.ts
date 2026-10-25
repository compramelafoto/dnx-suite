/**
 * Monitoreo de audio de la estación: lógica pura (sin navegador) para poder probarla.
 *
 * El monitoreo es sólo una rama de escucha: nunca toca el `MediaStream` ni las pistas que van al
 * `MediaRecorder`. El volumen del monitoreo no cambia lo grabado.
 */

/** Cuánto tiempo se mira hacia atrás para mostrar el pico en el medidor. */
export const VENTANA_PICO_MS = 300;
/** Silencio total durante más que esto: se muestra «Sin audio». */
export const SILENCIO_MS = 3000;
/** Por debajo de esto (≈ −80 dBFS) se considera silencio total: una capturadora sin audio manda ceros. */
export const UMBRAL_SILENCIO = 1e-4;
export const VOLUMEN_POR_DEFECTO = 80;

/** Pico absoluto (0 a 1) de las muestras de `getFloatTimeDomainData` (de −1 a 1). */
export function picoDeMuestras(muestras: ArrayLike<number>): number {
  let pico = 0;
  for (let i = 0; i < muestras.length; i++) {
    const v = Math.abs(muestras[i]);
    if (v > pico) pico = v;
  }
  return Math.min(1, pico);
}

/** El pico (0 a 1) como nivel entero de 0 a 100 para la barra. */
export function nivelDePico(pico: number): number {
  if (!Number.isFinite(pico) || pico <= 0) return 0;
  return Math.round(Math.min(1, pico) * 100);
}

export function esSilencio(pico: number): boolean {
  return !(pico >= UMBRAL_SILENCIO);
}

/** Volumen del monitoreo en porcentaje (0–100) → ganancia del `GainNode` (0–1). */
export function gananciaDeVolumen(porcentaje: number): number {
  if (!Number.isFinite(porcentaje)) return VOLUMEN_POR_DEFECTO / 100;
  return Math.min(100, Math.max(0, porcentaje)) / 100;
}

export type LecturaMedidor = { nivel: number; sinAudio: boolean };

/**
 * Junta las lecturas del analizador: el nivel es el pico de los últimos `VENTANA_PICO_MS`, y
 * `sinAudio` se prende cuando todo fue silencio total durante más de `SILENCIO_MS`.
 */
export class MedidorDeNivel {
  private muestras: { ms: number; pico: number }[] = [];
  private silencioDesdeMs: number | null = null;

  constructor(private readonly ventanaMs = VENTANA_PICO_MS, private readonly silencioMs = SILENCIO_MS) {}

  agregar(pico: number, ahoraMs: number): LecturaMedidor {
    this.muestras.push({ ms: ahoraMs, pico });
    this.muestras = this.muestras.filter((m) => ahoraMs - m.ms <= this.ventanaMs);
    if (esSilencio(pico)) {
      if (this.silencioDesdeMs === null) this.silencioDesdeMs = ahoraMs;
    } else {
      this.silencioDesdeMs = null;
    }
    const maximo = this.muestras.reduce((a, m) => Math.max(a, m.pico), 0);
    const sinAudio = this.silencioDesdeMs !== null && ahoraMs - this.silencioDesdeMs > this.silencioMs;
    return { nivel: nivelDePico(maximo), sinAudio };
  }

  reiniciar(): void {
    this.muestras = [];
    this.silencioDesdeMs = null;
  }
}

/**
 * - `NO_DISPONIBLE`: todavía no hay vista previa (no hay stream).
 * - `SIN_AUDIO`: el stream no tiene pista de audio: el botón queda deshabilitado.
 * - `INACTIVO`: se puede activar.
 * - `ACTIVO`: suena por los parlantes.
 */
export type EstadoMonitoreo = "NO_DISPONIBLE" | "SIN_AUDIO" | "INACTIVO" | "ACTIVO";

export function estadoMonitoreo(e: { hayStream: boolean; pistasDeAudio: number; activo: boolean }): EstadoMonitoreo {
  if (!e.hayStream) return "NO_DISPONIBLE";
  if (e.pistasDeAudio === 0) return "SIN_AUDIO";
  return e.activo ? "ACTIVO" : "INACTIVO";
}

export function textoBotonMonitoreo(estado: EstadoMonitoreo): string {
  if (estado === "ACTIVO") return "Dejar de monitorear";
  if (estado === "SIN_AUDIO") return "La capturadora no envía audio";
  return "Monitorear audio";
}

export function botonMonitoreoHabilitado(estado: EstadoMonitoreo): boolean {
  return estado === "ACTIVO" || estado === "INACTIVO";
}

export const AYUDA_MONITOREO =
  "Se escucha con un pequeño retraso. Si hay un micrófono cerca, usá auriculares para que no se acople. El volumen del monitoreo no cambia lo que se graba.";
