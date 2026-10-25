import { gananciaDeVolumen, picoDeMuestras } from "./monitoreo";

/**
 * Escucha del audio de la capturadora por los parlantes, con Web Audio:
 * `AudioContext` → `MediaStreamAudioSourceNode` → `GainNode` → parlantes, y un `AnalyserNode`
 * colgado de la fuente para el medidor.
 *
 * Es sólo una rama de escucha: no clona, no deshabilita ni detiene las pistas del stream que usa
 * el `MediaRecorder`. Al cerrar se desconectan los nodos y se cierra el `AudioContext`; las pistas
 * siguen como estaban.
 */
export class MonitorDeAudio {
  private cerrado = false;
  private readonly buffer: Float32Array<ArrayBuffer>;

  private constructor(
    private readonly ac: AudioContext,
    private readonly fuente: MediaStreamAudioSourceNode,
    private readonly ganancia: GainNode,
    private readonly analizador: AnalyserNode,
  ) {
    this.buffer = new Float32Array(analizador.fftSize);
  }

  /** Llamar dentro del clic: por la política de autoplay, el `AudioContext` nace con el gesto. */
  static abrir(stream: MediaStream, volumenPorcentaje: number): MonitorDeAudio {
    const ac = new AudioContext({ latencyHint: "interactive" });
    const fuente = ac.createMediaStreamSource(stream);
    const ganancia = ac.createGain();
    ganancia.gain.value = gananciaDeVolumen(volumenPorcentaje);
    const analizador = ac.createAnalyser();
    // 4096 muestras ≈ 85 ms a 48 kHz: leyendo cada ~80 ms no se escapa casi ningún pico.
    analizador.fftSize = 4096;
    fuente.connect(ganancia).connect(ac.destination);
    // El medidor mira la señal antes del volumen del monitoreo: muestra lo que llega (y se graba).
    fuente.connect(analizador);
    if (ac.state === "suspended") void ac.resume().catch(() => { /* si no arranca, el medidor queda en 0 */ });
    return new MonitorDeAudio(ac, fuente, ganancia, analizador);
  }

  cambiarVolumen(porcentaje: number): void {
    if (this.cerrado) return;
    // Rampa corta para que el cambio no haga "clic".
    this.ganancia.gain.setTargetAtTime(gananciaDeVolumen(porcentaje), this.ac.currentTime, 0.02);
  }

  /** Pico (0 a 1) de lo último que pasó por el analizador. */
  picoActual(): number {
    if (this.cerrado) return 0;
    this.analizador.getFloatTimeDomainData(this.buffer);
    return picoDeMuestras(this.buffer);
  }

  /** Se puede llamar más de una vez. Nunca detiene pistas. */
  cerrar(): void {
    if (this.cerrado) return;
    this.cerrado = true;
    try { this.fuente.disconnect(); } catch { /* ya desconectada */ }
    try { this.ganancia.disconnect(); } catch { /* ya desconectada */ }
    try { this.analizador.disconnect(); } catch { /* ya desconectado */ }
    void this.ac.close().catch(() => { /* ya cerrado */ });
  }
}
