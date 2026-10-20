import { procesadorDeCuadros } from "./apis-navegador";
import type { MensajeAlWorker, MensajeDelWorker } from "./analisis.worker";

/** Dueño del worker. Los mensajes del worker no los frena el navegador con la ventana minimizada. */
export class Analizador {
  private readonly worker: Worker;
  private readonly copias = new Set<MediaStreamTrack>();

  constructor(alMensaje: (m: MensajeDelWorker) => void) {
    this.worker = new Worker(new URL("./analisis.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<MensajeDelWorker>) => alMensaje(e.data);
  }

  iniciar(track: MediaStreamTrack, huella: number[] | null, minutosSinSenal: number): void {
    const { cuadros, copia } = procesadorDeCuadros(track);
    this.copias.add(copia);
    const m: MensajeAlWorker = { tipo: "iniciar", cuadros, huella, minutosSinSenal };
    this.worker.postMessage(m, [cuadros as unknown as Transferable]);
  }

  calibrar(track: MediaStreamTrack): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const previo = this.worker.onmessage;
      let copia: MediaStreamTrack | null = null;
      const soltar = () => {
        this.worker.onmessage = previo;
        if (copia) { copia.stop(); this.copias.delete(copia); }
      };
      this.worker.onmessage = (e: MessageEvent<MensajeDelWorker>) => {
        if (e.data.tipo === "huella") { soltar(); resolve(e.data.huella); }
        if (e.data.tipo === "error") { soltar(); reject(new Error(e.data.mensaje)); }
      };
      const p = procesadorDeCuadros(track);
      const cuadros = p.cuadros;
      copia = p.copia;
      this.copias.add(copia);
      this.worker.postMessage({ tipo: "calibrar", cuadros } satisfies MensajeAlWorker, [cuadros as unknown as Transferable]);
    });
  }

  detener(): void {
    for (const c of this.copias) c.stop();
    this.copias.clear();
    this.worker.postMessage({ tipo: "detener" } satisfies MensajeAlWorker);
    this.worker.terminate();
  }
}
