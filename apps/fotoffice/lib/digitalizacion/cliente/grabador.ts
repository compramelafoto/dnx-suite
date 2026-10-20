import { BITS_AUDIO, SEGUNDOS_POR_PARTE } from "../constants";

type Opciones = { stream: MediaStream; mimeType: string; bitsVideo: number; alPedacito: (b: Blob, indice: number) => void };

/** `MediaRecorder` con un pedacito cada 10 s. `detener` espera el último pedacito. */
export class Grabador {
  private rec: MediaRecorder | null = null;
  private indice = 0;

  constructor(private readonly o: Opciones, indiceInicial = 0) {
    this.indice = indiceInicial;
  }

  iniciar(): void {
    const rec = new MediaRecorder(this.o.stream, { mimeType: this.o.mimeType, videoBitsPerSecond: this.o.bitsVideo, audioBitsPerSecond: BITS_AUDIO });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.o.alPedacito(e.data, this.indice++);
    };
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
