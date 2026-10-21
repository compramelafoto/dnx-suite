import { BITS_AUDIO, SEGUNDOS_POR_PARTE } from "../constants";
import type { ResultadoPrueba } from "./formato";

type Opciones = { stream: MediaStream; mimeType: string; bitsVideo: number; alPedacito: (b: Blob, indice: number) => void; alError?: (detalle: string) => void };

/** El error de `MediaRecorder` en palabras: nombre y mensaje del navegador, para poder diagnosticarlo. */
function describirError(e: Event): string {
  const err = (e as Event & { error?: DOMException }).error;
  return err ? `${err.name}: ${err.message}` : "error desconocido del grabador";
}

/**
 * Graba ~1,5 s con la señal real y dice si el formato funciona: llegó un pedacito con datos y no
 * hubo error. No guarda nada.
 */
export function probarFormato(stream: MediaStream, mimeType: string, bitsVideo: number, ms = 1500): Promise<ResultadoPrueba> {
  return new Promise((resolve) => {
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitsVideo, audioBitsPerSecond: BITS_AUDIO });
    } catch (e) {
      resolve({ ok: false, error: e instanceof Error ? `${e.name}: ${e.message}` : "no se pudo crear el grabador" });
      return;
    }
    let datos = 0;
    let error: string | null = null;
    let listo = false;
    const terminar = () => {
      if (listo) return;
      listo = true;
      window.clearTimeout(reloj);
      resolve(error ? { ok: false, error } : datos > 0 ? { ok: true } : { ok: false, error: "no llegaron datos" });
    };
    rec.ondataavailable = (e) => { datos += e.data.size; };
    rec.onerror = (e) => { error = describirError(e); terminar(); };
    rec.onstop = () => terminar();
    const reloj = window.setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
      else terminar();
    }, ms);
    try {
      rec.start(500);
    } catch (e) {
      error = e instanceof Error ? `${e.name}: ${e.message}` : "no se pudo empezar";
      terminar();
    }
  });
}

/** `MediaRecorder` con un pedacito cada 10 s. `detener` espera el último pedacito. */
export class Grabador {
  private rec: MediaRecorder | null = null;
  private indice = 0;

  constructor(private readonly o: Opciones, indiceInicial = 0) {
    this.indice = indiceInicial;
  }

  iniciar(): void {
    if (this.rec) return; // ya iniciado: un segundo MediaRecorder duplicaría los pedacitos
    const rec = new MediaRecorder(this.o.stream, { mimeType: this.o.mimeType, videoBitsPerSecond: this.o.bitsVideo, audioBitsPerSecond: BITS_AUDIO });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.o.alPedacito(e.data, this.indice++);
    };
    rec.onerror = (e) => this.o.alError?.(describirError(e));
    rec.start(SEGUNDOS_POR_PARTE * 1000);
    this.rec = rec;
  }

  detener(): Promise<void> {
    const rec = this.rec;
    if (!rec || rec.state === "inactive") return Promise.resolve();
    return new Promise((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
      rec.stop();
    });
  }
}
