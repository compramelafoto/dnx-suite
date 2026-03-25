"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { Icon } from "@repo/design-system";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export interface WizardPremiumUploadZoneProps {
  previewUrl: string | null;
  onDataUrl: (dataUrl: string) => void;
  onClear: () => void;
  maxBytes?: number;
  className?: string;
}

/**
 * Dropzone de portada: icono de catálogo DS, estilos premium y recuadro consistente.
 */
export function WizardPremiumUploadZone({
  previewUrl,
  onDataUrl,
  onClear,
  maxBytes = 2 * 1024 * 1024,
  className = "",
}: WizardPremiumUploadZoneProps) {
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
    [maxBytes, onDataUrl],
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
      <div className={`w-full space-y-4 ${className}`}>
        <div className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-black/80">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Vista previa de portada"
            className="max-h-56 w-full object-cover object-center sm:max-h-64"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-amber-500/40 hover:text-white"
          >
            Cambiar imagen
          </button>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              onClear();
            }}
            className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/[0.1]"
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
    <div className={`w-full ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onInputChange}
      />
      {localError ? (
        <p className="mb-3 text-sm text-red-400" role="alert">
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
        className={[
          "mt-2 flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all sm:py-14",
          dragOver
            ? "border-amber-500/50 bg-amber-500/[0.05]"
            : "border-zinc-700/80 bg-[#09090c] hover:border-amber-500/40 hover:bg-[#0b0b10]",
        ].join(" ")}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] text-amber-400">
          <Icon name="upload" size="lg" />
        </div>
        <p className="mb-2 max-w-md text-center text-sm text-zinc-300 sm:text-base">
          Arrastrá una imagen aquí o <span className="font-semibold text-zinc-200">hacé click para subir</span>
        </p>
        <p className="mb-1 text-center text-xs leading-relaxed text-zinc-500">
          Formato recomendado 1920×1080 px · JPG, PNG o WebP · Máx. 2 MB
        </p>
      </button>
    </div>
  );
}
