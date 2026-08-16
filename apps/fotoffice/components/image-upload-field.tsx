"use client";

import { useRef, useState } from "react";
import {
  formatImagePresetRecommendation,
  getImagePreset,
  type ImagePresetKey,
} from "@/lib/images/presets";

type Status = "idle" | "uploading" | "error";

export function ImageUploadField({
  name,
  presetKey,
  label,
  description,
  initialUrl,
}: {
  /** Nombre del campo del form que recibe la URL final (ej. "logoUrl"). */
  name: string;
  presetKey: ImagePresetKey;
  label: string;
  description?: string;
  initialUrl?: string | null;
}) {
  const preset = getImagePreset(presetKey);
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(initialUrl ?? null);
  const [filename, setFilename] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<string | null>(null);
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!preset) return null;

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function readImageDimensions(file: File): Promise<{ width: number; height: number; objectUrl: string }> {
    const objectUrl = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, objectUrl });
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("No se pudo leer la imagen."));
      };
      img.src = objectUrl;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAspectWarning(null);

    if (!(preset!.acceptedFormats as readonly string[]).includes(file.type)) {
      setStatus("error");
      setError("Formato no admitido. Usá PNG, JPG o WebP.");
      return;
    }
    if (file.size > preset!.maxFileSizeBytes) {
      setStatus("error");
      setError(`El archivo supera el máximo de ${(preset!.maxFileSizeBytes / (1024 * 1024)).toFixed(0)} MB.`);
      return;
    }

    let dims: { width: number; height: number; objectUrl: string };
    try {
      dims = await readImageDimensions(file);
    } catch {
      setStatus("error");
      setError("No pudimos leer esa imagen. Probá con otro archivo.");
      return;
    }

    if (dims.width < preset!.minWidth || dims.height < preset!.minHeight) {
      setStatus("error");
      setError(
        `La imagen es demasiado chica (${dims.width} × ${dims.height} px). Mínimo: ${preset!.minWidth} × ${preset!.minHeight} px.`,
      );
      URL.revokeObjectURL(dims.objectUrl);
      return;
    }

    const actualRatio = dims.width / dims.height;
    const recommendedRatio = preset!.aspectRatio.width / preset!.aspectRatio.height;
    if (Math.abs(actualRatio - recommendedRatio) / recommendedRatio > preset!.aspectRatioTolerance) {
      setAspectWarning(
        "La imagen tiene una proporción distinta de la recomendada y puede recortarse al mostrarse.",
      );
    }

    setPreviewSrc(dims.objectUrl);
    setFilename(file.name);
    setDimensions(`${dims.width} × ${dims.height} px`);
    setSizeLabel(formatBytes(file.size));
    setStatus("uploading");

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("preset", presetKey);
      const res = await fetch("/api/uploads/image", { method: "POST", body });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "No se pudo subir la imagen.";
        setStatus("error");
        setError(message);
        return;
      }
      const uploadedUrl = (data as { url?: string }).url;
      if (!uploadedUrl) {
        setStatus("error");
        setError("Respuesta de subida inválida.");
        return;
      }
      setUrl(uploadedUrl);
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("No se pudo subir la imagen. Revisá tu conexión e intentá de nuevo.");
    }
  }

  function handleRemove() {
    setUrl(null);
    setPreviewSrc(null);
    setFilename(null);
    setDimensions(null);
    setSizeLabel(null);
    setAspectWarning(null);
    setError(null);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <span className="text-sm font-semibold text-[var(--fo-text)]">{label}</span>
      {description ? (
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">{description}</p>
      ) : null}
      <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
        {formatImagePresetRecommendation(preset)}
      </p>

      <input type="hidden" name={name} value={url ?? ""} />

      {previewSrc ? (
        <div className="flex items-center gap-4">
          <div
            className="shrink-0 overflow-hidden rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)]"
            style={{ width: 96, height: 96 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt=""
              className="h-full w-full"
              style={{ objectFit: preset.objectFit }}
            />
          </div>
          <div className="min-w-0 space-y-1 text-xs text-[var(--fo-muted)]">
            {filename ? <p className="truncate font-medium text-[var(--fo-text)]">{filename}</p> : null}
            {dimensions || sizeLabel ? (
              <p>
                {dimensions}
                {dimensions && sizeLabel ? " · " : ""}
                {sizeLabel}
              </p>
            ) : null}
            {status === "uploading" ? <p>Subiendo…</p> : null}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                className="text-[var(--fo-accent)] font-medium hover:underline"
                onClick={() => inputRef.current?.click()}
              >
                Reemplazar
              </button>
              <button
                type="button"
                className="text-[var(--fo-danger)] font-medium hover:underline"
                onClick={handleRemove}
              >
                Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          onClick={() => inputRef.current?.click()}
        >
          Seleccionar imagen
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={preset.acceptedFormats.join(",")}
        className="sr-only"
        onChange={handleFileChange}
      />

      {aspectWarning ? <p className="text-xs text-[var(--fo-warning,#a16207)]">{aspectWarning}</p> : null}
      {error ? <p className="text-xs text-[var(--fo-danger)]">{error}</p> : null}
    </div>
  );
}
