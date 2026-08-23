"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  SCAN_BAND_HEIGHT_CSS,
  SCAN_BASE_BLUR_CSS,
  SCAN_FALLBACK_BAND_HEIGHT_PX,
  computeContainedRect,
  computeScanDurationMs,
  type ScanContentRect,
} from "@/lib/photo/scan-protection";

export interface ScanProtectedPhotoProps {
  src: string;
  alt: string;
  /** Texto de la marca de agua que viaja dentro de la franja nítida. */
  watermarkLabel?: string;
  /** Clases de la imagen base (las mismas que tendría la foto sin protección). */
  imageClassName?: string;
  /** Estilos de la imagen base: tamaño, encuadre, object-fit. */
  imageStyle?: CSSProperties;
  /** Estilos del contenedor: acá va el zoom, para que las capas escalen juntas. */
  frameStyle?: CSSProperties;
  onLoad?: () => void;
}

/**
 * Fotografía protegida con una ventana de escaneo.
 *
 * Capa base desenfocada + capa nítida recortada a una franja que recorre la
 * imagen de arriba hacia abajo. Ambas capas usan la misma URL, así que el
 * navegador descarga una sola imagen.
 *
 * La animación es 100% CSS (`transform`): no hay estado de React por frame.
 */
export default function ScanProtectedPhoto({
  src,
  alt,
  watermarkLabel = "CompraMeLaFoto",
  imageClassName,
  imageStyle,
  frameStyle,
  onLoad,
}: ScanProtectedPhotoProps) {
  const baseRef = useRef<HTMLImageElement>(null);
  const patternId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [rect, setRect] = useState<ScanContentRect | null>(null);

  /** Mide el área real de la fotografía dentro de su caja (object-fit: contain). */
  const measure = useCallback(() => {
    const img = baseRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return;

    const next = computeContainedRect(
      img.naturalWidth,
      img.naturalHeight,
      img.clientWidth,
      img.clientHeight,
    );

    setRect((prev) => {
      if (
        prev &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5 &&
        Math.abs(prev.offsetX - next.offsetX) < 0.5 &&
        Math.abs(prev.offsetY - next.offsetY) < 0.5
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const onLoadRef = useRef(onLoad);

  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);

  const handleLoad = useCallback(() => {
    measure();
    onLoadRef.current?.();
  }, [measure]);

  // Imágenes cacheadas no siempre disparan onLoad: hay que avisar igual.
  useEffect(() => {
    const img = baseRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      measure();
      onLoadRef.current?.();
    }
  }, [measure, src]);

  // Reencuadre al rotar el dispositivo o redimensionar la ventana.
  useEffect(() => {
    const img = baseRef.current;
    if (!img || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(img);
    return () => observer.disconnect();
  }, [measure]);

  const bandHeightPx = rect
    ? Math.max(
        SCAN_FALLBACK_BAND_HEIGHT_PX * 0.7,
        Math.min(SCAN_FALLBACK_BAND_HEIGHT_PX * 1.2, rect.height * 0.36),
      )
    : SCAN_FALLBACK_BAND_HEIGHT_PX;

  const durationMs = computeScanDurationMs({
    frameHeightPx: rect?.height ?? 0,
    bandHeightPx,
  });
  const reducedDurationMs = computeScanDurationMs({
    frameHeightPx: rect?.height ?? 0,
    bandHeightPx,
    reducedMotion: true,
  });

  const frameVars = {
    "--cmf-scan-blur": SCAN_BASE_BLUR_CSS,
    "--cmf-scan-band": SCAN_BAND_HEIGHT_CSS,
    "--cmf-scan-duration": `${durationMs}ms`,
    "--cmf-scan-duration-reduced": `${reducedDurationMs}ms`,
    ...(rect
      ? {
          "--cmf-scan-x": `${rect.offsetX}px`,
          "--cmf-scan-y": `${rect.offsetY}px`,
          "--cmf-scan-w": `${rect.width}px`,
          "--cmf-scan-h": `${rect.height}px`,
        }
      : {}),
    ...frameStyle,
  } as CSSProperties;

  const measured = Boolean(rect && rect.height > 0);

  return (
    <span
      className="cmf-scan"
      style={frameVars}
      data-scan-protected="true"
      data-scan-measured={measured ? "true" : "false"}
    >
      <img
        ref={baseRef}
        src={src}
        alt={alt}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        className={`cmf-scan__base ${imageClassName ?? ""}`.trim()}
        style={imageStyle}
        onLoad={handleLoad}
      />

      {/* La franja siempre está presente: si la medición fallara, la protección
          sigue activa sobre toda la caja. Solo se muestra una vez alineada. */}
      <span className="cmf-scan__frame" aria-hidden="true" data-scan-window="true">
        <span className="cmf-scan__window">
          <span className="cmf-scan__inner">
            <img
              src={src}
              alt=""
              draggable={false}
              className="cmf-scan__sharp"
              aria-hidden="true"
            />
            <svg className="cmf-scan__mark" data-scan-watermark="true" aria-hidden="true">
              <defs>
                <pattern
                  id={`cmf-scan-mark-${patternId}`}
                  width="190"
                  height="96"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(-18)"
                >
                  <text
                    x="0"
                    y="44"
                    fill="rgba(255,255,255,0.42)"
                    stroke="rgba(0,0,0,0.18)"
                    strokeWidth="0.6"
                    fontSize="15"
                    fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
                    fontWeight="600"
                    letterSpacing="1.5"
                  >
                    {watermarkLabel}
                  </text>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#cmf-scan-mark-${patternId})`} />
            </svg>
          </span>
        </span>
      </span>
    </span>
  );
}
