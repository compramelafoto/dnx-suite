/**
 * Aviso sonoro del escáner de acreditación.
 *
 * El operador escanea mirando al participante, no a la pantalla: necesita saber
 * por el oído si el QR entró bien. Dos tonos claramente distintos, generados por
 * el navegador (sin archivos que descargar ni que fallen sin conexión).
 *
 * Nunca lanza: un navegador sin audio no puede romper la acreditación.
 */

export type ScanFeedbackKind = "ok" | "error" | "warning";

/** Frecuencia (Hz) y duración (ms) de cada aviso. */
const TONOS: Record<ScanFeedbackKind, Array<{ hz: number; ms: number }>> = {
  // Agudo y corto: entró bien.
  ok: [{ hz: 1320, ms: 90 }],
  // Dos golpes graves: no sirve, mirá la pantalla.
  error: [
    { hz: 320, ms: 140 },
    { hz: 240, ms: 200 },
  ],
  // Medio, repetido: entró, pero hay algo que revisar.
  warning: [
    { hz: 760, ms: 110 },
    { hz: 760, ms: 110 },
  ],
};

const VIBRACION: Record<ScanFeedbackKind, number[]> = {
  ok: [60],
  error: [120, 80, 120],
  warning: [90, 60, 90],
};

type AudioContextCtor = new () => AudioContext;

let contexto: AudioContext | null = null;

function obtenerContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!contexto) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextCtor })
          .webkitAudioContext;
      if (!Ctor) return null;
      contexto = new Ctor();
    }
    // Safari e iOS suspenden el contexto hasta que hay un gesto del usuario.
    if (contexto.state === "suspended") void contexto.resume();
    return contexto;
  } catch {
    return null;
  }
}

function reproducirTono(ctx: AudioContext, hz: number, ms: number, desdeMs: number) {
  const inicio = ctx.currentTime + desdeMs / 1000;
  const fin = inicio + ms / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = hz;
  // Rampa corta al abrir y cerrar: sin ella el tono chasquea.
  gain.gain.setValueAtTime(0.0001, inicio);
  gain.gain.exponentialRampToValueAtTime(0.25, inicio + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, fin);
  osc.connect(gain).connect(ctx.destination);
  osc.start(inicio);
  osc.stop(fin + 0.02);
}

/** Suena y vibra según el resultado del escaneo. Silencioso si el navegador no puede. */
export function avisarEscaneo(kind: ScanFeedbackKind): void {
  const ctx = obtenerContexto();
  if (ctx) {
    try {
      let desde = 0;
      for (const tono of TONOS[kind]) {
        reproducirTono(ctx, tono.hz, tono.ms, desde);
        desde += tono.ms + 40;
      }
    } catch {
      // Sin sonido: la pantalla sigue mostrando el resultado.
    }
  }
  try {
    navigator.vibrate?.(VIBRACION[kind]);
  } catch {
    // Sin vibración: no es crítico.
  }
}

/** Traduce el tono del resultado al tipo de aviso. */
export function avisoParaTono(tone: string | undefined): ScanFeedbackKind {
  if (tone === "GREEN") return "ok";
  if (tone === "RED") return "error";
  return "warning";
}
