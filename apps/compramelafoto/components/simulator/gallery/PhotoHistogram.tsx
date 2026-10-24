"use client";

import { histogramFromPixels, type HistogramData } from "@/lib/simulator/histogram";
import { useEffect, useState } from "react";

const WIDTH = 240;
const HEIGHT = 70;
const BINS = 64;
/** Se analiza la foto achicada: alcanza para el histograma y es instantáneo. */
const SAMPLE_WIDTH = 320;

/** Histograma de la foto ya tomada (como el de la pantalla de la cámara al revisar). */
export default function PhotoHistogram({ src }: { src: string }) {
  const [data, setData] = useState<HistogramData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = Math.min(SAMPLE_WIDTH, img.naturalWidth);
        const h = Math.max(1, Math.round((img.naturalHeight * w) / img.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext("2d", { willReadFrequently: true });
        if (!g) throw new Error("sin canvas");
        g.drawImage(img, 0, 0, w, h);
        setData(histogramFromPixels(g.getImageData(0, 0, w, h).data, BINS));
      } catch {
        // Una imagen de otro dominio sin permiso de lectura: no se puede analizar.
        setFailed(true);
      }
    };
    img.onerror = () => !cancelled && setFailed(true);
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) return null;
  const bins = data?.bins ?? [];
  const max = Math.max(...bins, 0.0001);
  const barW = WIDTH / BINS;

  return (
    <figure className="cod-photo-histogram" aria-label="Histograma de la foto">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="cod-photo-histogram__svg" aria-hidden="true">
        {bins.map((b, i) => {
          const h = (b / max) * (HEIGHT - 2);
          return <rect key={i} x={i * barW} y={HEIGHT - h} width={barW + 0.4} height={h} />;
        })}
      </svg>
      {data ? (
        <figcaption className="cod-photo-histogram__caption">
          <span className={data.clippedShadows > 0.02 ? "is-warn" : ""}>Sombras empastadas {Math.round(data.clippedShadows * 100)} %</span>
          <span className={data.clippedHighlights > 0.02 ? "is-warn" : ""}>Luces quemadas {Math.round(data.clippedHighlights * 100)} %</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
