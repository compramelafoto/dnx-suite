"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const BANNER_ASPECT = "21 / 4";
const RECOMMENDED_WIDTH = 1680;
const RECOMMENDED_HEIGHT = Math.round((RECOMMENDED_WIDTH * 4) / 21);

type BannerSlide = {
  src: string;
  alt: string;
  link?: string;
  openInNewTab?: boolean;
};

const DEFAULT_SLIDES: BannerSlide[] = [
  { src: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1600&q=80", alt: "Fotógrafo en sesión" },
  { src: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1600&q=80", alt: "Cámara y fotógrafo" },
  { src: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=1600&q=80", alt: "Persona mirando el celular" },
  { src: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1600&q=80", alt: "Fotógrafo trabajando" },
];

export default function AdminBannerPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [images, setImages] = useState<BannerSlide[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    loadBanner();
  }, []);

  async function loadBanner() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/banner", { credentials: "include" });
      if (!res.ok) throw new Error("Error cargando banner");
      const data = await res.json();
      setEnabled(typeof data.enabled === "boolean" ? data.enabled : true);
      setImages(Array.isArray(data.images) && data.images.length > 0 ? data.images : [...DEFAULT_SLIDES]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando banner");
      setImages([...DEFAULT_SLIDES]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled, images }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error guardando");
      }
      setSuccess("Banner del home guardado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando banner");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(index: number, file: File) {
    setUploadingIndex(index);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/banner/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error subiendo imagen");
      }
      const data = await res.json();
      if (data.url) {
        setImages((prev) => {
          const next = [...prev];
          next[index] = { ...next[index], src: data.url };
          return next;
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error subiendo imagen");
    } finally {
      setUploadingIndex(null);
    }
  }

  function addSlide() {
    setImages((prev) => [...prev, { src: "", alt: "" }]);
  }

  function removeSlide(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveUp(i: number) {
    if (i <= 0) return;
    setImages((prev) => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  }

  function moveDown(i: number) {
    if (i >= images.length - 1) return;
    setImages((prev) => {
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  }

  function updateSlide(i: number, field: keyof BannerSlide, value: string | boolean) {
    setImages((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  }

  function restoreDefaults() {
    setImages([...DEFAULT_SLIDES]);
    setSuccess(null);
    setError(null);
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-[#6b7280]">Cargando editor del banner...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">
        Banner del home
      </h1>
      <p className="text-[#6b7280] mb-2">
        Las imágenes se muestran en el slide de la franja superior del home. Podés subir archivos o pegar una URL.
      </p>
      <p className="text-sm text-[#c27b3d] font-medium mb-6">
        Resolución recomendada: {RECOMMENDED_WIDTH} × {RECOMMENDED_HEIGHT} px (proporción {BANNER_ASPECT}). Así la imagen se ve correctamente en el banner.
      </p>

      <Card className="p-4 mb-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-[#1a1a1a]">Banner en el home</label>
          <select
            value={enabled ? "enabled" : "disabled"}
            onChange={(e) => setEnabled(e.target.value === "enabled")}
            className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
          >
            <option value="enabled">Habilitado (visible)</option>
            <option value="disabled">Deshabilitado (oculto)</option>
          </select>
          <span className="text-sm text-[#6b7280]">
            {enabled ? "El banner se muestra en la página principal." : "El banner no se muestra en el home."}
          </span>
        </div>
      </Card>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">
          {success}
        </div>
      )}

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-[#1a1a1a]">
            Slides ({images.length})
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={restoreDefaults} className="text-sm">
              Restaurar por defecto
            </Button>
            <Button variant="primary" onClick={addSlide} className="text-sm">
              Agregar slide
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {images.map((img, i) => (
            <div
              key={i}
              className="flex flex-wrap items-start gap-4 p-4 rounded-lg border border-[#e5e7eb] bg-[#fafafa]"
            >
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <label className="text-xs font-medium text-[#6b7280]">Imagen</label>
                <div className="flex gap-2 flex-wrap">
                  <input
                    ref={(el) => { fileInputRefs.current[i] = el; }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(i, f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="secondary"
                    type="button"
                    className="text-sm"
                    disabled={uploadingIndex === i}
                    onClick={() => fileInputRefs.current[i]?.click()}
                  >
                    {uploadingIndex === i ? "Subiendo…" : "Subir imagen"}
                  </Button>
                  <span className="text-xs text-[#6b7280] self-center">o URL:</span>
                  <Input
                    value={img.src}
                    onChange={(e) => updateSlide(i, "src", e.target.value)}
                    placeholder="https://..."
                    className="text-sm flex-1 min-w-[200px]"
                  />
                </div>
                <label className="text-xs font-medium text-[#6b7280]">Texto alternativo (accesibilidad)</label>
                <Input
                  value={img.alt}
                  onChange={(e) => updateSlide(i, "alt", e.target.value)}
                  placeholder="Ej: Fotógrafo en sesión"
                  className="text-sm"
                />
                <label className="text-xs font-medium text-[#6b7280]">Link al hacer clic (opcional)</label>
                <Input
                  value={img.link ?? ""}
                  onChange={(e) => updateSlide(i, "link", e.target.value)}
                  placeholder="https://... o /ruta (dejar vacío = sin link)"
                  className="text-sm"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(img.openInNewTab)}
                    onChange={(e) => updateSlide(i, "openInNewTab", e.target.checked)}
                    className="rounded border-[#d1d5db]"
                  />
                  <span className="text-xs font-medium text-[#6b7280]">Abrir link en nueva pestaña</span>
                </label>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="p-2 rounded hover:bg-black/10 disabled:opacity-40"
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === images.length - 1}
                  className="p-2 rounded hover:bg-black/10 disabled:opacity-40"
                  title="Bajar"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeSlide(i)}
                  className="p-2 rounded hover:bg-red-100 text-red-600"
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
              {img.src && (
                <div className="w-full sm:w-40 h-16 relative rounded overflow-hidden bg-black/10 flex-shrink-0">
                  <Image
                    src={img.src}
                    alt={img.alt || "Preview"}
                    fill
                    className="object-cover"
                    sizes="160px"
                    unoptimized={img.src.startsWith("http")}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar banner"}
          </Button>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">Ver home</Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
