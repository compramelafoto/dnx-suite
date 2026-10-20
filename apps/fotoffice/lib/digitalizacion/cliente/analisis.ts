import { procesadorDeCuadros } from "./apis-navegador";
import type { MensajeAlWorker, MensajeDelWorker } from "./analisis.worker";

/** Dueño del worker. Los mensajes del worker no los frena el navegador con la ventana minimizada. */
export class Analizador {
  private readonly worker: Worker;

  constructor(alMensaje: (m: MensajeDelWorker) => void) {
    this.worker = new Worker(new URL("./analisis.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<MensajeDelWorker>) => alMensaje(e.data);
  }

  iniciar(track: MediaStreamTrack, huella: number[] | null, minutosSinSenal: number): void {
    const cuadros = procesadorDeCuadros(track);
    const m: MensajeAlWorker = { tipo: "iniciar", cuadros, huella, minutosSinSenal };
    this.worker.postMessage(m, [cuadros as unknown as Transferable]);
  }

  calibrar(track: MediaStreamTrack): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const previo = this.worker.onmessage;
      this.worker.onmessage = (e: MessageEvent<MensajeDelWorker>) => {
        if (e.data.tipo === "huella") { this.worker.onmessage = previo; resolve(e.data.huella); }
        if (e.data.tipo === "error") { this.worker.onmessage = previo; reject(new Error(e.data.mensaje)); }
      };
      const cuadros = procesadorDeCuadros(track);
      this.worker.postMessage({ tipo: "calibrar", cuadros } satisfies MensajeAlWorker, [cuadros as unknown as Transferable]);
    });
  }

  detener(): void {
    this.worker.postMessage({ tipo: "detener" } satisfies MensajeAlWorker);
    this.worker.terminate();
  }
}
