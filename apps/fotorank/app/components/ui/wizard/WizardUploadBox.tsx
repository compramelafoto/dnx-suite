"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Info } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export interface WizardUploadBoxProps {
  previewUrl: string | null;
  onDataUrl: (dataUrl: string) => void;
  onClear: () => void;
  maxBytes?: number;
  className?: string;
}

/**
 * Carga de portada: mismos tokens que el resto del dashboard (fr-border, gold).
 */
export function WizardUploadBox({
  previewUrl,
  onDataUrl,
  onClear,
  maxBytes = 2 * 1024 * 1024,
  className = "",
}: WizardUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const processFile = useCallback(
    (file: File) => {
      setLocalError(null);
      if (!ACCEPTED.includes(file.type)) {
        setLocalError("Usá JPG, PNG o WebP.");
        return;
      }
      if (file.size > maxBytes) {
        setLocalError("El archivo supera 2 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        if (typeof r === "string") onDataUrl(r);
      };
      reader.readAsDataURL(file);
    },
    [maxBytes, onDataUrl]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) processFile(file);
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  if (previewUrl) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#080808]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Vista previa de la portada del concurso"
            className="max-h-52 w-full object-cover object-center sm:max-h-60 md:max-h-72"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="fr-btn fr-btn-secondary min-h-[2.75rem] justify-center px-5 py-2.5 text-sm"
          >
            Cambiar imagen
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              onClear();
            }}
            className="inline-flex min-h-[2.75rem] items-center justify-center px-3 text-sm font-medium text-red-400/90 hover:text-red-300 sm:justify-start"
          >
            Quitar imagen
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onInputChange}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onInputChange}
      />
      {localError ? (
        <p className="mb-3 flex items-center gap-2 text-xs font-medium text-red-400" role="alert">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
          {localError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`group flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 transition-all duration-200 sm:px-8 sm:py-14 md:py-16 ${
          dragOver
            ? "border-gold/55 bg-gold/[0.06]"
            : "border-[#333] bg-[#080808] hover:border-gold/35 hover:bg-[#0c0c0c]"
        } focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25`}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#2e2e2e] bg-[#111] text-gold/90 transition-colors group-hover:border-gold/25 md:h-14 md:w-14">
          <ImagePlus className="h-6 w-6" aria-hidden strokeWidth={1.5} />
        </div>
        <span className="text-center text-[15px] font-semibold text-fr-primary">Imagen de portada</span>
        <span className="mt-2 max-w-md px-1 text-center text-sm leading-relaxed text-fr-muted">
          Arrastrá una imagen aquí o hacé click para subir
        </span>
        <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111] px-3 py-2 text-[10px] text-fr-muted sm:text-xs">
          <Info className="h-3.5 w-3.5 shrink-0 text-fr-muted-soft" aria-hidden strokeWidth={2} />
          <span className="text-left leading-snug">1920×1080 recomendado · JPG, PNG o WebP · máx. 2 MB</span>
        </div>
      </button>
    </div>
  );
}
