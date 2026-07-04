"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import { FlipSheet } from "@/components/fotolibros/FlipSheet";
import type { AlbumDocument, AlbumSpec, ImageAsset, Spread } from "@/components/fotolibros/types";

const CanvasEditor = dynamic(
  () => import("@/components/fotolibros/CanvasEditor").then((m) => m.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px] text-[#6b7280]">Cargando…</div> }
);

type BookState = "closed" | "opening" | "open";

const SPINE_WIDTH = 0;

/** Vista de spread con modelo hoja 2 caras. Base pages siempre clipeadas. Sheet solo cuando isFlipping. */
function FotolibroSpreadView({
  spec,
  spread,
  images,
  containerSize,
  isFlipping,
  direction,
  nextSpread,
  prevSpread,
  onFlipEnd,
}: {
  spec: AlbumSpec;
  spread: Spread;
  images: ImageAsset[];
  containerSize: { width: number; height: number };
  isFlipping: boolean;
  direction: "next" | "prev";
  nextSpread: Spread | null;
  prevSpread: Spread | null;
  onFlipEnd: () => void;
}) {
  const w = Math.max(200, containerSize.width * 0.6 - SPINE_WIDTH);
  const h = Math.max(200, containerSize.height * 0.6);
  const halfW = (w - SPINE_WIDTH) / 2;

  const isNext = direction === "next";
  const destSpread = isNext ? nextSpread : prevSpread;

  /*
   * Mapeo layflat 180° (hoja 2 caras, sin revealPhase).
   * direction=next: BaseLeft=current, BaseRight=next, Sheet.front=current.right, Sheet.back=next.left
   * direction=prev: BaseLeft=prev, BaseRight=current, Sheet.front=current.left, Sheet.back=prev.right
   * Base usa splitSpreads (un canvas) para evitar línea en el pliegue.
   */
  const baseLeftSpread = isFlipping ? (isNext ? spread : (prevSpread ?? spread)) : spread;
  const baseRightSpread = isFlipping ? (isNext ? (nextSpread ?? spread) : spread) : spread;

  return (
    <div className="fotolibro-stage">
      <div
        className={`fotolibro-book shrink-0 ${isFlipping ? "fotolibro-book-flipping" : ""}`}
        style={{
          width: w,
          height: h,
          minWidth: w,
          minHeight: h,
        }}
      >
        {/* Páginas base: SIEMPRE un solo canvas (splitSpreads durante giro) para eliminar línea del pliegue */}
        <div className="fotolibro-pages">
          <div className="fotolibro-page fotolibro-page-full">
            <CanvasEditor
              spec={spec}
              spread={spread}
              images={images}
              selectedItemIds={[]}
              onSelectItems={() => {}}
              onChangeItem={() => {}}
              onChangeText={() => {}}
              onCreateFrame={() => {}}
              onCreateText={() => {}}
              onAssignImage={() => {}}
              transformDisabled
              previewMode
              showAddActions={false}
              viewMode="spread"
              containerWidth={w}
              containerHeight={h}
              allowOverflow={false}
              splitSpreads={isFlipping && baseLeftSpread && baseRightSpread ? { left: baseLeftSpread, right: baseRightSpread } : undefined}
            />
          </div>
        </div>

        {/* Sombra de contacto sobre la página base (lado del giro) */}
        {isFlipping && destSpread && (
          <div
            className={`fotolibro-base-shadow ${isNext ? "fotolibro-base-shadow-left" : "fotolibro-base-shadow-right"}`}
            aria-hidden
          />
        )}

        {/* Hoja 2 caras: solo durante el giro. front=actual que gira, back=destino */}
        {isFlipping && destSpread && (
          <FlipSheet
            spec={spec}
            frontSpread={spread}
            backSpread={destSpread}
            images={images}
            direction={direction}
            halfW={halfW}
            h={h}
            onAnimationEnd={onFlipEnd}
          />
        )}

      </div>
    </div>
  );
}

export default function FotolibroVistaPage() {
  const params = useParams();
  const id = params?.id ? String(params.id) : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<AlbumDocument | null>(null);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [bookState, setBookState] = useState<BookState>("closed");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [isFlipping, setIsFlipping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!id) {
      setError("ID de proyecto no válido");
      setLoading(false);
      return;
    }
    fetch(`/api/fotolibros-test/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Proyecto no encontrado");
        return r.json();
      })
      .then((data) => {
        const raw = data?.data;
        if (!raw) {
          setError("Datos del proyecto no válidos");
          return;
        }
        if (raw.document && Array.isArray(raw.images)) {
          setDoc(raw.document as AlbumDocument);
          setImages(raw.images as ImageAsset[]);
        } else if (raw.spec && Array.isArray(raw.spreads)) {
          setDoc(raw as AlbumDocument);
          setImages([]);
        } else {
          setError("Formato de proyecto no reconocido");
        }
      })
      .catch((e) => setError(e?.message || "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const updateSize = () => {
      const el = containerRef.current;
      if (el && el.clientWidth > 0 && el.clientHeight > 0) {
        setContainerSize({ width: el.clientWidth, height: el.clientHeight });
      } else if (typeof window !== "undefined") {
        setContainerSize({ width: window.innerWidth, height: window.innerHeight - 120 });
      }
    };
    const el = containerRef.current;
    if (!el) {
      updateSize();
      return;
    }
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    updateSize();
    return () => ro.disconnect();
  }, [bookState]);

  const spreads = doc?.spreads ?? [];
  const currentSpread = spreads[currentIndex] ?? null;
  const hasPrev = bookState === "open" && currentIndex > 0;
  const hasNext = bookState === "open" && currentIndex < spreads.length - 1;

  const openBook = useCallback(() => {
    if (bookState !== "closed") return;
    setBookState("opening");
    setTimeout(() => setBookState("open"), 1200);
  }, [bookState]);

  const pageTurnSoundRef = useRef<HTMLAudioElement | null>(null);
  const playPageTurnSound = useCallback(() => {
    try {
      const audio =
        pageTurnSoundRef.current ??
        (pageTurnSoundRef.current = new Audio(
          "https://assets.mixkit.co/active_storage/sfx/2570-paper-flip-001-0.mp3"
        ));
      audio.currentTime = 0;
      audio.volume = 0.4;
      audio.play().catch(() => {});
    } catch {
      /* ignorar */
    }
  }, []);

  const handleFlipEnd = useCallback(() => {
    setCurrentIndex((i) => (direction === "next" ? i + 1 : i - 1));
    setIsFlipping(false);
  }, [direction]);

  const goPrev = useCallback(() => {
    if (!hasPrev || isFlipping) return;
    playPageTurnSound();
    setIsFlipping(true);
    setDirection("prev");
  }, [hasPrev, isFlipping, playPageTurnSound]);

  const goNext = useCallback(() => {
    if (!hasNext || isFlipping) return;
    playPageTurnSound();
    setIsFlipping(true);
    setDirection("next");
  }, [hasNext, isFlipping, playPageTurnSound]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (bookState === "closed") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openBook();
        }
        return;
      }
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [bookState, goPrev, goNext, openBook]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9]">
        <p className="text-[#6b7280]">Cargando fotolibro…</p>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f1f5f9] p-6">
        <p className="text-red-600 mb-4">{error || "Proyecto no encontrado"}</p>
        <Link href="/admin/plantillas/disenador">
          <Button variant="secondary">Volver al diseñador</Button>
        </Link>
      </div>
    );
  }

  const spec: AlbumSpec = doc.spec;

  if (bookState === "closed" || bookState === "opening") {
    return (
      <div className="min-h-screen flex flex-col bg-[#f1f5f9]">
        <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-[#e5e7eb] shadow-sm">
          <Link href="/admin/plantillas/disenador" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
            ← Diseñador
          </Link>
          <Link href={`/fotolibro/${id}/imprimir`}>
            <Button variant="primary" accentColor="#22c55e">
              Imprimir
            </Button>
          </Link>
        </header>
        <div
          ref={containerRef}
          className="flex-1 min-h-0 flex items-center justify-center p-8 cursor-pointer [perspective:900px]"
          onClick={openBook}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openBook();
            }
          }}
        >
          <div
            className={`fotolibro-book-cover ${bookState === "opening" ? "fotolibro-cover-opening" : ""}`}
            style={{
              width: Math.min(containerSize.width * 0.5, 360),
              height: Math.min(containerSize.height * 0.6, 480),
              maxWidth: "100%",
            }}
          >
            <div className="w-full h-full bg-[#f5f5f5] rounded-lg border-2 border-[#e5e7eb] shadow-2xl flex flex-col items-center justify-center">
              <div className="text-center px-8">
                <p className="text-[#6b7280] text-sm mb-6">
                  {bookState === "closed" ? "El libro se abre…" : "Abriendo…"}
                </p>
                <div className="w-16 h-20 mx-auto border-2 border-dashed border-[#d1d5db] rounded flex items-center justify-center text-[#9ca3af] text-2xl">
                  📖
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f1f5f9]">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-[#e5e7eb] shadow-sm">
        <Link href="/admin/plantillas/disenador" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
          ← Diseñador
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[#374151] text-sm">
            Página {currentIndex + 1} de {spreads.length}
          </span>
          <Link href={`/fotolibro/${id}/imprimir`}>
            <Button variant="primary" accentColor="#22c55e">
              Imprimir
            </Button>
          </Link>
        </div>
      </header>

      <div ref={containerRef} className="flex-1 min-h-0 flex items-center justify-center relative overflow-hidden">
        {hasPrev && (
          <button
            type="button"
            onClick={goPrev}
            disabled={isFlipping}
            className="absolute left-4 z-20 w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-md border border-[#e5e7eb] flex items-center justify-center text-[#374151] transition-colors disabled:opacity-50"
            aria-label="Página anterior"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <div className={`flex-1 flex items-center justify-center min-w-0 min-h-0 w-full ${isFlipping ? "overflow-visible" : "overflow-hidden"}`}>
          {currentSpread && (
            <FotolibroSpreadView
              spec={spec}
              spread={currentSpread}
              images={images}
              containerSize={containerSize}
              isFlipping={isFlipping}
              direction={direction}
              nextSpread={spreads[currentIndex + 1] ?? null}
              prevSpread={spreads[currentIndex - 1] ?? null}
              onFlipEnd={handleFlipEnd}
            />
          )}
          {!currentSpread && spreads.length === 0 && (
            <div className="text-[#9ca3af] text-sm">No hay páginas en este proyecto.</div>
          )}
        </div>

        {hasNext && (
          <button
            type="button"
            onClick={goNext}
            disabled={isFlipping}
            className="absolute right-4 z-20 w-12 h-12 rounded-full bg-white/90 hover:bg-white shadow-md border border-[#e5e7eb] flex items-center justify-center text-[#374151] transition-colors disabled:opacity-50"
            aria-label="Página siguiente"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}
      </div>

      <div className="shrink-0 flex justify-center gap-1.5 py-3">
        {spreads.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (isFlipping) return;
              setDirection(i > currentIndex ? "next" : "prev");
              setCurrentIndex(i);
            }}
            disabled={isFlipping}
            className={`w-2 h-2 rounded-full transition-colors disabled:opacity-50 ${
              i === currentIndex ? "bg-[#c27b3d]" : "bg-[#4b5563] hover:bg-[#6b7280]"
            }`}
            aria-label={`Ir a página ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
