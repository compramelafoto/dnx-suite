"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PAPER_TOKENS, TemplateCanvasRenderer, editorThemeStyle } from "@repo/template-editor-ui";
import type { DesignV2Data } from "@/lib/design-v2/design-data";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { bookLeaves, bookSpreadLabel, type BookFace } from "@/lib/design-v2/book-leaves";
import { designPhotoOverrides, sinFondoDelDiseno, visibleDesignBlocks } from "@/lib/design-v2/render-inputs";

/**
 * El librito armado, encuadernado y con giro de páginas en 3D. Solo para que el fotógrafo vea
 * cómo queda en la mano antes de ofrecerlo: dibuja las mismas caras que el editor (mismas fotos,
 * mismos encuadres), cortando cada pliego doble por el medio.
 *
 * Se puede girar de a 90° (botón «Girar» o flechas ↑ ↓), para los diseños que se leen de costado
 * como la carpeta de San Patricio, y arrastrar para inclinarlo y verlo desde otro ángulo.
 */

type Props = {
  template: DesignTemplatePayload;
  photos: DesignPhotoPayload[];
  data: DesignV2Data;
  onClose: () => void;
};

const FLIP_MS = 900;

/** Lugar disponible para el libro abierto: casi todo el ancho y lo que queda de alto. */
function useViewport(): { width: number; height: number } {
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () => setBox({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return box;
}

export default function BookPreview3D({ template, photos, data, onClose }: Props) {
  const leaves = useMemo(() => bookLeaves(template.pageCount), [template.pageCount]);
  const [flipped, setFlipped] = useState(0);
  // La hoja que está girando va arriba de todas mientras dura el giro.
  const [moving, setMoving] = useState<number | null>(null);
  const viewport = useViewport();
  // Giro de a 90°, acumulado: así siempre gira para el mismo lado.
  const [giro, setGiro] = useState(0);
  // Inclinación al arrastrar, en grados.
  const [orbita, setOrbita] = useState({ x: 0, y: 0 });
  const arrastre = useRef<{ x: number; y: number; ox: number; oy: number; movio: boolean } | null>(null);
  const deCostado = Math.abs(giro % 180) === 90;

  const photoUrlById = useMemo(() => new Map(photos.map((p) => [p.id, p.url])), [photos]);
  const blocks = useMemo(() => visibleDesignBlocks(template.blocks, data.values), [template.blocks, data.values]);
  const overrides = useMemo(() => designPhotoOverrides(data.slots, photoUrlById, sinFondoDelDiseno(template.blocks, photos)), [data.slots, photoUrlById, template, photos]);

  const canvasW = Number(template.canvas.width) || 1;
  const canvasH = Number(template.canvas.height) || 1;
  // De costado, el libro abierto ocupa el alto de la pantalla con su ancho.
  const anchoDisponible = Math.min(viewport.width, 1400) - 48;
  const altoDisponible = viewport.height - 220;
  const scale =
    viewport.width > 0
      ? deCostado
        ? Math.min(altoDisponible / canvasW, anchoDisponible / canvasH)
        : Math.min(anchoDisponible / canvasW, altoDisponible / canvasH)
      : 0;
  const pageW = (canvasW * scale) / 2;
  const pageH = canvasH * scale;

  const go = useCallback(
    (delta: number) => {
      setFlipped((current) => {
        const next = Math.max(0, Math.min(leaves.length, current + delta));
        if (next !== current) setMoving(delta > 0 ? current : next);
        return next;
      });
    },
    [leaves.length],
  );

  useEffect(() => {
    if (moving == null) return;
    const t = window.setTimeout(() => setMoving(null), FLIP_MS);
    return () => window.clearTimeout(t);
  }, [moving, flipped]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setGiro((g) => g + 90);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setGiro((g) => g - 90);
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  // Cerrado se ve solo la tapa (o la contratapa): el libro se corre para quedar centrado.
  const shift = flipped === 0 ? -pageW / 2 : flipped === leaves.length ? pageW / 2 : 0;

  function face(f: BookFace, side: "front" | "back") {
    return (
      <div
        className="absolute inset-0 overflow-hidden bg-white"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: side === "back" ? "rotateY(180deg)" : undefined,
          borderRadius: side === "front" ? "0 4px 4px 0" : "4px 0 0 4px",
          // Sombra en la cara y no en la hoja: un `filter` en la hoja aplana el 3D.
          boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            ...editorThemeStyle(),
            ...PAPER_TOKENS,
            position: "absolute",
            left: f.half === "left" ? 0 : -pageW,
            top: 0,
            width: canvasW,
            height: canvasH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <TemplateCanvasRenderer
            canvas={template.canvas}
            blocks={blocks}
            resolvedVariables={data.values}
            readOnly
            pageIndex={f.pageIndex}
            photoOverrides={overrides}
          />
        </div>
        {/* Sombra del lomo: la página se hunde hacia el doblez. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              side === "front"
                ? "linear-gradient(to right, rgba(0,0,0,0.22), rgba(0,0,0,0.06) 4%, transparent 10%)"
                : "linear-gradient(to left, rgba(0,0,0,0.22), rgba(0,0,0,0.06) 4%, transparent 10%)",
          }}
        />
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista 3D del librito"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#1f2937]/85 px-6 py-6"
      onClick={onClose}
    >
      <div className="mb-4 flex w-full max-w-screen-xl items-center justify-between text-white" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-base font-semibold">Vista 3D del librito</p>
          <p className="text-xs text-white/70">{template.name} · los textos son de ejemplo</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-white/40 hover:bg-white/10"
        >
          Cerrar
        </button>
      </div>

      {scale > 0 ? (
        <div
          style={{ perspective: 2400, touchAction: "none", cursor: arrastre.current ? "grabbing" : "grab" }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => {
            arrastre.current = { x: e.clientX, y: e.clientY, ox: orbita.x, oy: orbita.y, movio: false };
          }}
          onPointerMove={(e) => {
            const a = arrastre.current;
            if (!a) return;
            const dx = e.clientX - a.x;
            const dy = e.clientY - a.y;
            if (!a.movio && Math.hypot(dx, dy) < 5) return;
            if (!a.movio) {
              a.movio = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }
            setOrbita({
              x: Math.max(-45, Math.min(45, a.ox - dy * 0.3)),
              y: Math.max(-60, Math.min(60, a.oy + dx * 0.3)),
            });
          }}
          onPointerUp={() => {
            // Un arrastre no es un clic: la hoja no se pasa al soltar.
            const a = arrastre.current;
            arrastre.current = null;
            if (a?.movio) {
              const anular = (ev: MouseEvent) => {
                ev.stopPropagation();
                ev.preventDefault();
              };
              window.addEventListener("click", anular, { capture: true, once: true });
              window.setTimeout(() => window.removeEventListener("click", anular, { capture: true }), 0);
            }
          }}
          onPointerCancel={() => {
            arrastre.current = null;
          }}
          onDoubleClick={() => setOrbita({ x: 0, y: 0 })}
        >
          <div
            className="relative transition-transform duration-700 ease-out motion-reduce:transition-none"
            style={{
              width: pageW * 2,
              height: pageH,
              transformStyle: "preserve-3d",
              transform:
                `rotateX(${6 + orbita.x}deg) rotateY(${orbita.y}deg) rotateZ(${giro}deg) ` +
                `translateX(${shift}px)`,
              transitionDuration: arrastre.current?.movio ? "0ms" : undefined,
            }}
          >
            {leaves.map((leaf, i) => {
              const isFlipped = i < flipped;
              const z = moving === i ? leaves.length + 1 : isFlipped ? i + 1 : leaves.length - i;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={-1}
                  aria-label={isFlipped ? "Volver la hoja" : "Pasar la hoja"}
                  onClick={() => go(isFlipped ? -1 : 1)}
                  className="absolute top-0 cursor-pointer motion-reduce:transition-none"
                  style={{
                    left: pageW,
                    width: pageW,
                    height: pageH,
                    zIndex: z,
                    transformOrigin: "left center",
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(-180deg)" : "rotateY(0deg)",
                    transition: `transform ${FLIP_MS}ms cubic-bezier(.645,.045,.355,1)`,
                  }}
                >
                  {face(leaf.front, "front")}
                  {face(leaf.back, "back")}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3 text-white" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Página anterior"
          onClick={() => go(-1)}
          disabled={flipped === 0}
          className="rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-white/40 hover:bg-white/10 disabled:opacity-40"
        >
          ←
        </button>
        <span className="min-w-[150px] text-center text-sm" aria-live="polite">
          {bookSpreadLabel(flipped, leaves.length)}
        </span>
        <button
          type="button"
          aria-label="Página siguiente"
          onClick={() => go(1)}
          disabled={flipped === leaves.length}
          className="rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-white/40 hover:bg-white/10 disabled:opacity-40"
        >
          →
        </button>
        <button
          type="button"
          onClick={() => setGiro((g) => g + 90)}
          aria-label="Girar el librito 90 grados"
          className="ml-2 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-white/40 hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v5h-5" />
          </svg>
          Girar
        </button>
      </div>
      <p className="mt-2 text-xs text-white/60">
        Clic en una hoja o ← → para pasarla · ↑ ↓ o «Girar» para girarlo · arrastrá para inclinarlo
        (doble clic lo endereza) · Esc cierra.
      </p>
    </div>
  );
}
