"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";
import Link from "next/link";
import Button from "@/components/ui/Button";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 4 * 1024 * 1024;

export type AlbumCoverManagerProps = {
  albumId: number;
  /** Fotos activas del álbum (0 = todavía no subió nada). */
  photosCount: number;
  coverPhotoId: number | null;
  /** Portada propia ya guardada (imagen subida a mano). */
  customCoverUrl: string | null;
  /** Vista previa de la portada basada en una foto del álbum. */
  photoCoverPreviewUrl: string | null;
  onChanged: (next: { coverPhotoId: number | null; customCoverUrl: string | null }) => void;
  /** Título opcional; se oculta cuando el bloque ya vive dentro de una tarjeta con encabezado. */
  showHeading?: boolean;
};

export default function AlbumCoverManager({
  albumId,
  photosCount,
  coverPhotoId,
  customCoverUrl,
  photoCoverPreviewUrl,
  onChanged,
  showHeading = true,
}: AlbumCoverManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  // react-easy-crop entrega primero el área en porcentajes: es la que espera la API.
  const onCropComplete = useCallback((areaPercent: Area) => {
    setCroppedArea(areaPercent);
  }, []);

  function closeCropper() {
    if (saving) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    setPendingFile(null);
    setCroppedArea(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const type = (file.type || "").toLowerCase();
    if (!ALLOWED_TYPES.includes(type)) {
      setError("Formato no soportado. Usá JPG, PNG, WebP o GIF.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("La imagen no puede superar 4 MB.");
      e.target.value = "";
      return;
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(URL.createObjectURL(file));
    setPendingFile(file);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
  }

  async function handleSave() {
    if (!pendingFile) return;
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      if (croppedArea) formData.append("cropArea", JSON.stringify(croppedArea));

      const res = await fetch(`/api/dashboard/albums/${albumId}/cover/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo subir la portada");

      onChanged({ coverPhotoId: null, customCoverUrl: data.coverImageUrl ?? null });
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
      setPendingFile(null);
      setCroppedArea(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la portada");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/cover/upload`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo quitar la portada");
      onChanged({ coverPhotoId: null, customCoverUrl: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la portada");
    } finally {
      setRemoving(false);
    }
  }

  const previewUrl = customCoverUrl || photoCoverPreviewUrl;
  const hasPhotos = photosCount > 0;

  let statusText: string;
  if (customCoverUrl) {
    statusText = hasPhotos
      ? "Portada propia: es una imagen aparte, no se vende ni aparece en la galería."
      : "Portada propia: no cuenta como foto subida, así que el álbum sigue mostrando el mensaje de aviso y el formulario para dejar datos.";
  } else if (coverPhotoId) {
    statusText = `Foto #${coverPhotoId} configurada como portada.`;
  } else if (hasPhotos) {
    statusText = "Sin portada elegida: se muestra la primera foto del álbum.";
  } else {
    statusText =
      "Todavía no hay portada. Podés subir una imagen ahora sin que cuente como foto del álbum.";
  }

  return (
    <div className="ds-stack-section w-full gap-4">
      {showHeading ? (
        <div className="ds-content-container w-full space-y-1">
          <h3 className="text-base font-semibold text-[#1a1a1a] m-0">Portada del álbum</h3>
          <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] m-0">
            Imagen que se ve en listados y al compartir el álbum.
          </p>
        </div>
      ) : null}

      <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
        <div className="mx-auto sm:mx-0 shrink-0 w-[min(100%,12rem)] aspect-square rounded-xl border border-[#e5e7eb] bg-[#fafafa] overflow-hidden">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Portada del álbum"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center px-3 text-center">
              <span className="text-xs text-[#9ca3af]">Sin portada</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <p className="ds-readable-text text-sm text-[#1a1a1a] m-0">{statusText}</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFilePicked}
            className="hidden"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="whitespace-nowrap"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || removing}
            >
              {customCoverUrl ? "Cambiar imagen de portada" : "Subir imagen de portada"}
            </Button>

            {hasPhotos ? (
              <Link href={`/dashboard/albums/${albumId}?tab=fotos`} prefetch={false}>
                <Button type="button" variant="secondary" size="md" className="whitespace-nowrap">
                  Elegir portada entre las fotos
                </Button>
              </Link>
            ) : null}

            {customCoverUrl ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="whitespace-nowrap"
                onClick={handleRemove}
                disabled={saving || removing}
              >
                {removing ? "Quitando…" : "Quitar portada"}
              </Button>
            ) : null}
          </div>

          {!hasPhotos ? (
            <p className="text-xs text-[#6b7280] m-0 leading-relaxed">
              Cuando subas las fotos vas a poder elegir la portada entre ellas y esta imagen se
              reemplaza.
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600 m-0">{error}</p> : null}
        </div>
      </div>

      {mounted && objectUrl
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[100] bg-black/60" onClick={closeCropper} aria-hidden />
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-[#1a1a1a] m-0">Recortar portada</h3>
                    <button
                      type="button"
                      onClick={closeCropper}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                      aria-label="Cerrar"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="relative w-full h-[380px] overflow-hidden rounded-lg bg-black/90">
                    <Cropper
                      image={objectUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="text-sm text-[#6b7280]">Zoom</label>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1"
                    />
                  </div>

                  {error ? <p className="text-sm text-red-600 m-0">{error}</p> : null}

                  <div className="flex justify-end gap-2 border-t border-[#e5e7eb] pt-3">
                    <Button type="button" variant="secondary" onClick={closeCropper} disabled={saving}>
                      Cancelar
                    </Button>
                    <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
                      {saving ? "Guardando…" : "Guardar portada"}
                    </Button>
                  </div>
                </div>
              </div>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
