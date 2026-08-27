"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import Image from "next/image";

import CopyrightNotice from "./CopyrightNotice";
import ScanProtectedPhoto from "./ScanProtectedPhoto";
import { shouldApplyScanProtection } from "@/lib/photo/scan-protection";

interface Photo {
  id: string;
  src: string;
  alt: string;
  selected?: boolean;
  /** El cliente ya compró esta foto: se muestra sin la ventana de escaneo. */
  purchased?: boolean;
}

interface PhotoSlideViewerProps {
  photos: Photo[];
  initialIndex?: number;
  onClose: () => void;
  onPhotoSelect?: (id: string) => void;
  /** Total estimado de la selección (ej. galerías DIGITAL_UNIFORM con fotos elegidas). */
  selectionTotalLabel?: string | null;
  renderControls?: (photo: Photo, index: number) => React.ReactNode;
  onDelete?: (id: string) => void;
  enableZoom?: boolean;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  /**
   * Activa la protección visual (foto desenfocada + franja nítida móvil) sobre
   * las fotos no compradas. Solo para vistas de cliente: los paneles internos
   * de fotógrafo, laboratorio e impresión no la usan.
   */
  protectUnpurchased?: boolean;
  /** Texto de la marca de agua que viaja dentro de la franja. */
  watermarkLabel?: string;
}

const HISTORY_STATE_KEY = "photoSlideViewer";

function KeyCap({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex h-[26px] min-w-[26px] shrink-0 items-center justify-center rounded-[4px] border border-[#a3a3a3] border-b-[3px] border-b-[#6b6b6b] bg-gradient-to-b from-[#fafafa] via-[#ececec] to-[#d6d6d6] px-1.5 font-sans text-[11px] font-semibold leading-none text-[#2d2d2d] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.45)] ${className}`}
    >
      {children}
    </kbd>
  );
}

function SpaceBarKey() {
  return (
    <kbd
      className="inline-flex h-[26px] min-w-[4.75rem] shrink-0 items-center justify-center rounded-[4px] border border-[#a3a3a3] border-b-[3px] border-b-[#6b6b6b] bg-gradient-to-b from-[#fafafa] via-[#ececec] to-[#d6d6d6] px-2 font-sans text-[9px] font-semibold uppercase tracking-[0.2em] text-[#555] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      espacio
    </kbd>
  );
}

function HintDivider() {
  return <span className="mx-1 hidden h-3 w-px shrink-0 bg-white/20 sm:inline" aria-hidden />;
}

function DesktopKeyboardHints({
  showSelect,
  showDelete,
}: {
  showSelect: boolean;
  showDelete: boolean;
}) {
  return (
    <div
      className="pointer-events-none inline-flex max-w-full flex-nowrap items-center justify-center gap-2 overflow-x-auto rounded-xl border border-white/12 bg-black/65 px-3 py-2 text-white backdrop-blur-sm sm:gap-2.5 sm:px-4"
      aria-label="Atajos de teclado"
    >
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <span className="flex items-center gap-0.5" aria-hidden>
          <KeyCap className="text-[13px]">←</KeyCap>
          <KeyCap className="text-[13px]">→</KeyCap>
        </span>
        <span className="text-[11px] text-white/75 sm:text-xs">Cambiar foto</span>
      </div>

      {showSelect ? (
        <>
          <HintDivider />
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <SpaceBarKey />
            <span className="text-[11px] text-white/75 sm:text-xs">Seleccionar</span>
          </div>
        </>
      ) : null}

      <HintDivider />
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <KeyCap className="min-w-[2.25rem] px-1.5 text-[10px]">Esc</KeyCap>
        <span className="text-[11px] text-white/75 sm:text-xs">Cerrar</span>
      </div>

      {showDelete ? (
        <>
          <HintDivider />
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <KeyCap className="min-w-[2rem] px-1 text-[9px]">Del</KeyCap>
            <span className="text-[11px] text-white/75 sm:text-xs">Eliminar</span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SelectActionLabel({
  selected,
  mobile,
}: {
  selected: boolean;
  mobile?: boolean;
}) {
  const actionLabel = mobile
    ? selected
      ? "Seleccionada para comprar"
      : "Seleccionar para comprar"
    : selected
      ? "Seleccionada"
      : "Seleccionar";

  return <span className="text-sm font-medium">{actionLabel}</span>;
}

function SelectionRunningTotal({
  label,
  mobile,
}: {
  label: string;
  mobile?: boolean;
}) {
  return (
    <p
      className={`font-semibold tabular-nums text-white/90 ${
        mobile ? "text-center text-sm" : "text-right text-xs"
      }`}
      aria-live="polite"
    >
      Total {label}
    </p>
  );
}

export default function PhotoSlideViewer({
  photos,
  initialIndex = 0,
  onClose,
  onPhotoSelect,
  selectionTotalLabel,
  renderControls,
  onDelete,
  enableZoom = false,
  minZoom = 1,
  maxZoom = 3,
  zoomStep = 0.25,
  protectUnpurchased = false,
  watermarkLabel,
}: PhotoSlideViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoading, setImageLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(currentIndex);
  const onCloseRef = useRef(onClose);
  const historyPushedRef = useRef(false);
  const closingFromButtonRef = useRef(false);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const canZoomOut = zoom > minZoom + 0.001;
  const canZoomIn = zoom < maxZoom - 0.001;

  const requestClose = useCallback(() => {
    if (typeof window !== "undefined" && historyPushedRef.current && window.history.state?.[HISTORY_STATE_KEY]) {
      closingFromButtonRef.current = true;
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, []);

  // En móvil, el botón/gesto "atrás" del navegador debe cerrar el visor, no salir de la compra.
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.history.pushState({ [HISTORY_STATE_KEY]: true }, "");
    historyPushedRef.current = true;

    function handlePopState() {
      historyPushedRef.current = false;
      if (closingFromButtonRef.current) {
        closingFromButtonRef.current = false;
      }
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      historyPushedRef.current = false;
    };
  }, []);

  // Bloquear scroll del body mientras el visor está abierto.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const imageRef = useRef<HTMLImageElement>(null);

  const goToPhoto = useCallback((index: number) => {
    setCurrentIndex(index);
    setImageLoading(true);
    setZoom(1);
  }, []);

  // Dar foco al overlay al abrir para que las teclas funcionen.
  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  // Navegación con teclado: flechas para pasar, Espacio para seleccionar, ESC para cerrar.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const idx = currentIndexRef.current;
        goToPhoto(idx > 0 ? idx - 1 : photos.length - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const idx = currentIndexRef.current;
        goToPhoto(idx < photos.length - 1 ? idx + 1 : 0);
        return;
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        const idx = currentIndexRef.current;
        if (onPhotoSelect && photos[idx]) {
          onPhotoSelect(photos[idx].id);
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && onDelete) {
        e.preventDefault();
        const idx = currentIndexRef.current;
        const current = photos[idx];
        if (current) {
          onDelete(current.id);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos, onPhotoSelect, onDelete, requestClose, goToPhoto]);

  // Sincronizar solo cuando el padre cambia initialIndex (no al navegar dentro del visor).
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < photos.length) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setImageLoading(true);
    }
  }, [initialIndex, photos.length]);

  function handlePrevious() {
    goToPhoto(currentIndex > 0 ? currentIndex - 1 : photos.length - 1);
  }

  function handleNext() {
    goToPhoto(currentIndex < photos.length - 1 ? currentIndex + 1 : 0);
  }

  function handleThumbnailClick(index: number) {
    goToPhoto(index);
  }

  // Imágenes en caché no disparan onLoad al cambiar de slide.
  useEffect(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImageLoading(false);
    }
  }, [currentIndex, photos]);

  function handleZoomOut() {
    setZoom((prev) => Math.max(minZoom, Math.round((prev - zoomStep) * 100) / 100));
  }

  function handleZoomIn() {
    setZoom((prev) => Math.min(maxZoom, Math.round((prev + zoomStep) * 100) / 100));
  }

  function handleZoomReset() {
    setZoom(1);
  }

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  if (!currentPhoto) return null;

  const scanProtected = shouldApplyScanProtection({
    enabled: protectUnpurchased,
    purchased: currentPhoto.purchased,
  });

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Vista ampliada de fotos"
      className="fixed inset-0 z-50 flex flex-col bg-black/95 outline-none overscroll-contain"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      {/* Barra superior móvil: cierre explícito y visible */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b border-white/15 bg-black/90 px-3 py-3 sm:hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            requestClose();
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg active:scale-[0.98]"
          aria-label="Cerrar y volver a la galería"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a la galería
        </button>
        <span className="text-sm font-medium text-white/90 tabular-nums">
          {currentIndex + 1} / {photos.length}
        </span>
      </div>

      {/* Header escritorio */}
      <div
        className="absolute top-0 left-0 right-0 z-10 hidden items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4 sm:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm text-white">
          {currentIndex + 1} / {photos.length}
        </div>
        <div className="flex items-center gap-4">
          {onPhotoSelect ? (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoSelect(currentPhoto.id);
                }}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors ${
                  currentPhoto.selected
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
                aria-label={currentPhoto.selected ? "Deseleccionar foto" : "Seleccionar foto"}
              >
                {currentPhoto.selected ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <SelectActionLabel selected />
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <SelectActionLabel selected={false} />
                  </>
                )}
              </button>
              {selectionTotalLabel ? (
                <SelectionRunningTotal label={selectionTotalLabel} />
              ) : null}
            </div>
          ) : null}
          {enableZoom && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomOut();
                }}
                className="rounded-md bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/30 disabled:opacity-50"
                aria-label="Alejar"
                disabled={!canZoomOut}
              >
                -
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomReset();
                }}
                className="rounded-md bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/30"
                aria-label="Restablecer zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn();
                }}
                className="rounded-md bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/30 disabled:opacity-50"
                aria-label="Acercar"
                disabled={!canZoomIn}
              >
                +
              </button>
            </div>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(currentPhoto.id);
              }}
              className="rounded-md bg-red-600/80 px-3 py-2 text-sm text-red-100 hover:bg-red-600"
              aria-label="Eliminar foto"
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              requestClose();
            }}
            className="cursor-pointer p-2 text-white transition-colors hover:text-gray-300"
            aria-label="Cerrar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Acciones móvil (seleccionar) */}
      {onPhotoSelect ? (
        <div
          className="flex w-full shrink-0 flex-col gap-1.5 border-b border-white/10 bg-black/80 px-3 py-2.5 sm:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPhotoSelect(currentPhoto.id);
            }}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
              currentPhoto.selected
                ? "bg-green-600 text-white"
                : "bg-white/15 text-white active:bg-white/25"
            }`}
            aria-label={currentPhoto.selected ? "Deseleccionar foto" : "Seleccionar foto"}
          >
            {currentPhoto.selected ? (
              <SelectActionLabel selected mobile />
            ) : (
              <SelectActionLabel selected={false} mobile />
            )}
          </button>
          {selectionTotalLabel ? (
            <SelectionRunningTotal label={selectionTotalLabel} mobile />
          ) : null}
        </div>
      ) : null}

      {/* Imagen principal */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center p-2 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 hidden w-full shrink-0 sm:flex sm:justify-center">
          <DesktopKeyboardHints showSelect={Boolean(onPhotoSelect)} showDelete={Boolean(onDelete)} />
        </div>

        {scanProtected ? (
          <div className="mb-2 flex w-full shrink-0 justify-center px-4">
            <CopyrightNotice variant="compact" />
          </div>
        ) : null}

        <div className="relative flex w-full flex-1 items-center justify-center">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
            className="absolute top-1/2 left-2 z-20 -translate-y-1/2 cursor-pointer rounded-full bg-black/55 p-2.5 text-white transition-colors hover:bg-black/75 sm:left-4 sm:p-3"
            aria-label="Foto anterior"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 sm:h-8 sm:w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div className="relative flex w-full max-w-full items-center justify-center sm:w-1/2 sm:max-w-none">
          {imageLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            </div>
          )}
          <div className="relative flex w-full max-h-[calc(100dvh-11rem)] items-center justify-center overflow-auto sm:max-h-[calc(100vh-200px)]">
            {scanProtected ? (
              <ScanProtectedPhoto
                key={currentPhoto.id}
                src={currentPhoto.src}
                alt={currentPhoto.alt}
                watermarkLabel={watermarkLabel}
                imageClassName={`h-auto w-full transition-opacity duration-300 ${
                  imageLoading ? "opacity-0" : "opacity-100"
                }`}
                imageStyle={{
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: "calc(100dvh - 11rem)",
                  objectFit: "contain",
                }}
                frameStyle={{
                  transform: `scale(${zoom})`,
                  transition: "transform 150ms ease",
                }}
                onLoad={() => setImageLoading(false)}
              />
            ) : (
              <img
                ref={imageRef}
                key={currentPhoto.id}
                src={currentPhoto.src}
                alt={currentPhoto.alt}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className={`h-auto w-full transition-opacity duration-300 ${
                  imageLoading ? "opacity-0" : "opacity-100"
                }`}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: "calc(100dvh - 11rem)",
                  objectFit: "contain",
                  transform: `scale(${zoom})`,
                  transition: "transform 150ms ease",
                }}
                onLoad={() => setImageLoading(false)}
              />
            )}
          </div>
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute top-1/2 right-2 z-20 -translate-y-1/2 cursor-pointer rounded-full bg-black/55 p-2.5 text-white transition-colors hover:bg-black/75 sm:right-4 sm:p-3"
            aria-label="Foto siguiente"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 sm:h-8 sm:w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        </div>
      </div>

      {renderControls && (
        <div className="absolute bottom-24 left-1/2 z-20 w-full max-w-4xl -translate-x-1/2 px-4">
          <div className="rounded-lg bg-black/70 p-4 text-white">
            {renderControls(currentPhoto, currentIndex)}
          </div>
        </div>
      )}

      {photos.length > 1 && (
        <div className="absolute right-0 bottom-0 left-0 overflow-x-auto bg-gradient-to-t from-black/80 to-transparent p-3 sm:p-4">
          <div className="flex max-w-full justify-center gap-2">
            {photos.map((photo, index) => (
              <button
                type="button"
                key={photo.id}
                onClick={() => handleThumbnailClick(index)}
                className={`relative h-16 w-16 flex-shrink-0 cursor-pointer overflow-hidden rounded border-2 transition-all sm:h-20 sm:w-20 ${
                  index === currentIndex
                    ? "scale-105 border-white"
                    : "border-transparent opacity-60 hover:scale-105 hover:opacity-100"
                }`}
                aria-label={`Ver foto ${index + 1}`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
                {photo.selected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-600/50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="pointer-events-none px-4 pb-3 text-center text-[11px] leading-snug text-white/60 sm:hidden">
        Usá <strong className="text-white/85">Volver a la galería</strong> o el botón atrás del celular
        para seguir comprando.
      </p>
    </div>
  );
}
