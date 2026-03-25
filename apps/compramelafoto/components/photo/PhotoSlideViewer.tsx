"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface Photo {
  id: string;
  src: string;
  alt: string;
  selected?: boolean;
}

interface PhotoSlideViewerProps {
  photos: Photo[];
  initialIndex?: number;
  onClose: () => void;
  onPhotoSelect?: (id: string) => void;
  renderControls?: (photo: Photo, index: number) => React.ReactNode;
}

export default function PhotoSlideViewer({
  photos,
  initialIndex = 0,
  onClose,
  onPhotoSelect,
  renderControls,
}: PhotoSlideViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoading, setImageLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  // Dar foco al overlay al abrir para que las teclas funcionen
  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  // Navegación con teclado: flechas para pasar, Espacio para seleccionar, ESC para cerrar
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
        setImageLoading(true);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
        setImageLoading(true);
        return;
      }
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        const idx = currentIndexRef.current;
        if (onPhotoSelect && photos[idx]) {
          onPhotoSelect(photos[idx].id);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photos, onClose, onPhotoSelect]);

  function handlePrevious() {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
    setImageLoading(true);
  }

  function handleNext() {
    setCurrentIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
    setImageLoading(true);
  }

  function handleThumbnailClick(index: number) {
    setCurrentIndex(index);
    setImageLoading(true);
  }

  if (photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];
  
  // Actualizar el índice cuando cambia la foto seleccionada desde fuera
  useEffect(() => {
    if (initialIndex !== currentIndex && initialIndex >= 0 && initialIndex < photos.length) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex]);

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col outline-none"
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header con botón cerrar y selección */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white text-sm">
          {currentIndex + 1} / {photos.length}
        </div>
        <div className="flex items-center gap-4">
          {onPhotoSelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPhotoSelect(currentPhoto.id);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                currentPhoto.selected
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-white/20 hover:bg-white/30 text-white"
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
                  <span className="text-sm font-medium">Seleccionada</span>
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
                  <span className="text-sm font-medium">Seleccionar</span>
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-white hover:text-gray-300 transition-colors p-2 cursor-pointer"
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

      {/* Imagen principal */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón anterior */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-3 bg-black/50 rounded-full hover:bg-black/70 z-20 cursor-pointer"
            aria-label="Foto anterior"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Imagen - 50% del ancho de la pantalla */}
        <div className="relative flex items-center justify-center" style={{ width: "50%", maxHeight: "calc(100vh - 200px)" }}>
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>
          )}
          <div className="relative w-full flex items-center justify-center" style={{ maxHeight: "100%" }}>
            <img
              src={currentPhoto.src}
              alt={currentPhoto.alt}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              className={`w-full h-auto transition-opacity duration-300 ${
                imageLoading ? "opacity-0" : "opacity-100"
              }`}
              style={{ 
                maxWidth: "100%", 
                height: "auto",
                maxHeight: "calc(100vh - 200px)",
                objectFit: "contain"
              }}
              onLoad={() => setImageLoading(false)}
            />
          </div>
        </div>

        {/* Botón siguiente */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors p-3 bg-black/50 rounded-full hover:bg-black/70 z-20 cursor-pointer"
            aria-label="Foto siguiente"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {renderControls && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20">
          <div className="bg-black/70 rounded-lg p-4 text-white">
            {renderControls(currentPhoto, currentIndex)}
          </div>
        </div>
      )}

      {/* Miniaturas en la parte inferior */}
      {photos.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 overflow-x-auto">
          <div className="flex gap-2 justify-center max-w-full">
            {photos.map((photo, index) => (
              <button
                type="button"
                key={photo.id}
                onClick={() => handleThumbnailClick(index)}
                className={`relative flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all cursor-pointer ${
                  index === currentIndex
                    ? "border-white scale-110"
                    : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
                }`}
                aria-label={`Ver foto ${index + 1}`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  unoptimized
                />
                {photo.selected && (
                  <div className="absolute inset-0 bg-green-600/50 flex items-center justify-center">
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

      {/* Instrucciones */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/70 text-xs text-center pointer-events-none">
        <p>Flechas para navegar • Espacio para seleccionar • ESC para cerrar</p>
      </div>
    </div>
  );
}
