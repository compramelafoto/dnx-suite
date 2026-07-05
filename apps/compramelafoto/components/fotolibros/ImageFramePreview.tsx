"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { FrameItem, FrameShape } from "./types";
import { getCoverCrop, getRotationFillScale, getContainSize, getRotationFillZoom } from "./imageCrop";

type ImageFramePreviewProps = {
  imageUrl: string;
  frame: FrameItem;
  onChange: (next: Partial<FrameItem>) => void;
  /** Si false, oculta la manija de rotación. Por defecto true. */
  allowRotate?: boolean;
};

const PREVIEW_MAX_WIDTH = 260;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

/** Área de contenido: todas las formas usan el frame completo. Igual que CanvasEditor. */
function getShapeContentSize(shape: FrameShape, w: number, h: number): { contentW: number; contentH: number } {
  return { contentW: w, contentH: h };
}

/** Devuelve el path SVG "d" para usar en clip-path: path() — misma geometría que el canvas. */
function getClipPathD(shape: FrameShape, w: number, h: number): string {
  const { contentW, contentH } = getShapeContentSize(shape, w, h);
  const ox = (w - contentW) / 2;
  const oy = (h - contentH) / 2;
  const cx = contentW / 2;
  const cy = contentH / 2;
  const r = Math.min(contentW, contentH) / 2;
  if (shape === "circle") return ""; // se usa border-radius
  if (shape === "triangle") return `M ${ox + cx} ${oy} L ${ox + contentW} ${oy + contentH} L ${ox} ${oy + contentH} Z`;
  if (shape === "pentagon") {
    const points: string[] = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      points.push(`${ox + cx + r * Math.cos(a)} ${oy + cy + r * Math.sin(a)}`);
    }
    return `M ${points[0]} L ${points[1]} L ${points[2]} L ${points[3]} L ${points[4]} Z`;
  }
  if (shape === "heart") {
    const u = contentW / 8;
    const v = contentH / 7;
    const hcx = ox + cx;
    const hcy = oy + 2 * v;
    return `M ${hcx} ${hcy + v} C ${hcx} ${hcy - 2 * v}, ${hcx - 4 * u} ${hcy - 2 * v}, ${hcx - 4 * u} ${hcy + v} C ${hcx - 4 * u} ${hcy + 3 * v}, ${hcx} ${hcy + 5 * v}, ${hcx} ${hcy + 5 * v} C ${hcx} ${hcy + 5 * v}, ${hcx + 4 * u} ${hcy + 3 * v}, ${hcx + 4 * u} ${hcy + v} C ${hcx + 4 * u} ${hcy - 2 * v}, ${hcx} ${hcy - 2 * v}, ${hcx} ${hcy + v} Z`;
  }
  return "";
}

/**
 * Vista previa que muestra la imagen exactamente como en el fotolibro:
 * misma forma de recorte (círculo, corazón, etc.) y mismo zoom/recorte/rotación.
 * Sigue siendo interactiva: arrastrar, rueda y manija para ajustar.
 */
export default function ImageFramePreview({ imageUrl, frame, onChange, allowRotate = true }: ImageFramePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [rotateStart, setRotateStart] = useState<{ angle: number; startRotation: number } | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoadedImage(null);
  }, [imageUrl]);

  const frameW = frame.width;
  const frameH = frame.height;
  const shape = frame.shape ?? "rect";
  const { contentW, contentH } = getShapeContentSize(shape, frameW, frameH);
  const aspect = contentH / contentW;
  const previewW = PREVIEW_MAX_WIDTH;
  const previewH = Math.round(PREVIEW_MAX_WIDTH * aspect);
  const scaleFactor = previewW / contentW;
  const rotation = frame.imageRotation ?? 0;
  const rotationFillScale = getRotationFillScale(rotation);

  // Misma lógica que el canvas: crop para cover, tamaño para contain. Zoom efectivo >= fill para que siempre llene.
  const fillZoom = getRotationFillZoom(rotation);
  const effectiveZoom = Math.max(frame.imageZoom || 1, fillZoom);
  const itemForCoverCrop = {
    ...frame,
    width: contentW * rotationFillScale,
    height: contentH * rotationFillScale,
  };
  const coverCrop =
    loadedImage && frame.fitMode === "cover"
      ? getCoverCrop(loadedImage, itemForCoverCrop, effectiveZoom)
      : null;
  const containBase =
    loadedImage && frame.fitMode === "contain"
      ? getContainSize(loadedImage, contentW, contentH, effectiveZoom)
      : null;
  const containSize =
    containBase
      ? {
          width: containBase.width * rotationFillScale,
          height: containBase.height * rotationFillScale,
        }
      : null;

  const handlePanMove = useCallback(
    (e: MouseEvent) => {
      if (!panStart) return;
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const newOffsetX = panStart.offsetX + dx;
      const newOffsetY = panStart.offsetY + dy;
      onChange({
        imageOffsetX: Math.round(newOffsetX / scaleFactor),
        imageOffsetY: Math.round(newOffsetY / scaleFactor),
      });
    },
    [panStart, scaleFactor, onChange]
  );

  const handlePanUp = useCallback(() => setPanStart(null), []);

  useEffect(() => {
    if (!panStart) return;
    window.addEventListener("mousemove", handlePanMove);
    window.addEventListener("mouseup", handlePanUp);
    return () => {
      window.removeEventListener("mousemove", handlePanMove);
      window.removeEventListener("mouseup", handlePanUp);
    };
  }, [panStart, handlePanMove, handlePanUp]);

  const handleRotateMove = useCallback(
    (e: MouseEvent) => {
      if (!rotateStart || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.bottom - 20;
      const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      const delta = angle - rotateStart.angle;
      let newRot = rotateStart.startRotation + delta;
      newRot = Math.max(-15, Math.min(15, newRot));
      const fillZoom = getRotationFillZoom(newRot);
      onChange({ imageRotation: newRot, imageZoom: fillZoom });
    },
    [rotateStart, onChange]
  );

  const handleRotateUp = useCallback(() => setRotateStart(null), []);

  useEffect(() => {
    if (!rotateStart) return;
    window.addEventListener("mousemove", handleRotateMove);
    window.addEventListener("mouseup", handleRotateUp);
    return () => {
      window.removeEventListener("mousemove", handleRotateMove);
      window.removeEventListener("mouseup", handleRotateUp);
    };
  }, [rotateStart, handleRotateMove, handleRotateUp]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY * 0.003;
    const minZoom = Math.max(ZOOM_MIN, getRotationFillZoom(rotation));
    const newZoom = Math.max(minZoom, Math.min(ZOOM_MAX, (frame.imageZoom || 1) + delta));
    onChange({ imageZoom: newZoom });
  };

  const clipStyle =
    shape === "rect"
      ? {}
      : shape === "circle"
        ? { borderRadius: "50%" }
        : { clipPath: `path("${getClipPathD(shape, previewW, previewH)}")` };
  const coverPreviewW = contentW * scaleFactor * rotationFillScale;
  const coverPreviewH = contentH * scaleFactor * rotationFillScale;

  return (
    <div ref={containerRef} className="space-y-2">
      <p className="text-xs text-[#6b7280]">
        {allowRotate
          ? "Arrastrá la imagen para re-encuadrar, usá la rueda para zoom y la manija para rotar."
          : "Arrastrá la imagen para re-encuadrar y usá la rueda para zoom."}
      </p>
      {/* Contenedor sin clip: área de arrastre completa para formas como corazón donde clipPath limitaba eventos */}
      <div
        className="relative overflow-hidden bg-[#e5e7eb] select-none"
        style={{ width: previewW, height: previewH }}
      >
        {/* Imagen oculta solo para cargar y obtener dimensiones */}
        <img
          src={imageUrl}
          alt=""
          className="hidden"
          ref={(el) => {
            if (!el) return;
            if (el.complete && el.naturalWidth) setLoadedImage(el);
            else {
              el.onload = () => setLoadedImage(el);
            }
          }}
        />

        {/* Capa visual con clip: corazón, triángulo, etc. */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ width: previewW, height: previewH, ...clipStyle, pointerEvents: "none" }}
        >
          {/* Vista previa idéntica al canvas: mismo recorte, zoom y forma */}
          {loadedImage && frame.fitMode === "cover" && coverCrop && (
            <div
              className="absolute overflow-hidden"
              style={{
                width: coverPreviewW,
                height: coverPreviewH,
                left: "50%",
                top: "50%",
                marginLeft: -coverPreviewW / 2,
                marginTop: -coverPreviewH / 2,
                transform: `rotate(${rotation}deg)`,
              }}
            >
              <div
                className="w-full h-full bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: `${(loadedImage.naturalWidth * coverPreviewW) / coverCrop.cropWidth}px ${(loadedImage.naturalHeight * coverPreviewH) / coverCrop.cropHeight}px`,
                  backgroundPosition: `${-(coverCrop.cropX * coverPreviewW) / coverCrop.cropWidth}px ${-(coverCrop.cropY * coverPreviewH) / coverCrop.cropHeight}px`,
                }}
              />
            </div>
          )}
          {loadedImage && frame.fitMode === "contain" && containSize && (
            <div
              className="absolute overflow-hidden pointer-events-none"
              style={{
                left: "50%",
                top: "50%",
                marginLeft: -(containSize.width * scaleFactor) / 2,
                marginTop: -(containSize.height * scaleFactor) / 2,
                width: containSize.width * scaleFactor,
                height: containSize.height * scaleFactor,
                transform: `rotate(${rotation}deg)`,
              }}
            >
              <img
                src={imageUrl}
                alt=""
                className="w-full h-full object-contain"
                style={{ width: containSize.width * scaleFactor, height: containSize.height * scaleFactor }}
              />
            </div>
          )}
          {(!loadedImage || (frame.fitMode === "cover" && !coverCrop) || (frame.fitMode === "contain" && !containSize)) && (
            <div
              className="absolute inset-0 flex items-center justify-center text-xs text-[#6b7280]"
              style={{ width: previewW, height: previewH }}
            >
              Cargando…
            </div>
          )}
        </div>

        {/* Capa de arrastre: cuadrado completo (sin clip) para mover la foto libremente en corazón, etc. */}
        <div
          className="absolute inset-0 cursor-move z-10"
          style={{ width: previewW, height: previewH }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            setPanStart({
              x: e.clientX,
              y: e.clientY,
              offsetX: (frame.imageOffsetX ?? 0) * scaleFactor,
              offsetY: (frame.imageOffsetY ?? 0) * scaleFactor,
            });
          }}
          onWheel={onWheel}
        />

        {allowRotate && (
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-grab active:cursor-grabbing"
            style={{ bottom: -28, width: 40, height: 24 }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              e.stopPropagation();
              const rect = containerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const cx = rect.left + rect.width / 2;
              const cy = rect.bottom - 20;
              const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
              setRotateStart({ angle, startRotation: frame.imageRotation ?? 0 });
            }}
          >
            <svg width="40" height="24" viewBox="0 0 40 24" fill="none" className="text-[#c27b3d]">
              <path
                d="M8 20 A12 12 0 0 1 32 20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="20" cy="8" r="3" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
