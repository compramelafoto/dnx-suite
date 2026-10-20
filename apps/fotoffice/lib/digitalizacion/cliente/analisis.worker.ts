/// <reference lib="webworker" />
import { ALTO, ANCHO, calcularRasgos, promediarHuellas, type Rasgos } from "../senal/rasgos";
import { clasificar, type ClaseCuadro } from "../senal/clasificador";
import { avanzarSegundo, cerrarCorte, estadoInicial, latidoDebido, type ResumenCorte } from "../senal/corte";

export type MensajeAlWorker =
  | { tipo: "iniciar"; cuadros: ReadableStream<VideoFrame>; huella: number[] | null; minutosSinSenal: number }
  | { tipo: "calibrar"; cuadros: ReadableStream<VideoFrame> }
  | { tipo: "detener" };

export type MensajeDelWorker =
  | { tipo: "segundo"; seg: number; clase: ClaseCuadro; sinImagenHaceSeg: number | null; cortar: boolean; latido: boolean; resumen: ResumenCorte }
  | { tipo: "huella"; huella: number[] }
  | { tipo: "error"; mensaje: string };

const lienzo = new OffscreenCanvas(ANCHO, ALTO);
const ctx2d = lienzo.getContext("2d", { willReadFrequently: true })!;
let lector: ReadableStreamDefaultReader<VideoFrame> | null = null;
const enviar = (m: MensajeDelWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

function rasgosDe(cuadro: VideoFrame): Rasgos {
  ctx2d.drawImage(cuadro, 0, 0, ANCHO, ALTO);
  return calcularRasgos(ctx2d.getImageData(0, 0, ANCHO, ALTO).data);
}

/** Recorre los cuadros y entrega uno por segundo de video (por su marca de tiempo, no por reloj). */
async function porSegundo(cuadros: ReadableStream<VideoFrame>, fn: (r: Rasgos, seg: number) => boolean | void) {
  lector = cuadros.getReader();
  let inicio: number | null = null;
  let proximo = 0;
  for (;;) {
    const { value: cuadro, done } = await lector.read();
    if (done || !cuadro) return;
    try {
      inicio ??= cuadro.timestamp;
      const seg = Math.floor((cuadro.timestamp - inicio) / 1_000_000);
      if (seg >= proximo) {
        proximo = seg + 1;
        if (fn(rasgosDe(cuadro), seg) === false) return;
      }
    } finally {
      cuadro.close();
    }
  }
}

self.onmessage = async (ev: MessageEvent<MensajeAlWorker>) => {
  const m = ev.data;
  try {
    if (m.tipo === "detener") {
      await lector?.cancel();
      lector = null;
      return;
    }
    if (m.tipo === "calibrar") {
      const huellas: number[][] = [];
      await porSegundo(m.cuadros, (r) => { huellas.push(r.huella); return huellas.length < 5; });
      await lector?.cancel();
      enviar({ tipo: "huella", huella: promediarHuellas(huellas) });
      return;
    }
    let estado = estadoInicial();
    let anterior: Rasgos | null = null;
    await porSegundo(m.cuadros, (r) => {
      const clase = clasificar(r, anterior, m.huella);
      anterior = r;
      const paso = avanzarSegundo(estado, clase, m.minutosSinSenal);
      estado = paso.estado;
      enviar({
        tipo: "segundo",
        seg: estado.seg,
        clase,
        sinImagenHaceSeg: paso.sinImagenHaceSeg,
        cortar: paso.cortar,
        latido: latidoDebido(estado.seg),
        resumen: cerrarCorte(estado),
      });
    });
  } catch (e) {
    enviar({ tipo: "error", mensaje: e instanceof Error ? e.message : "Error del análisis" });
  }
};
