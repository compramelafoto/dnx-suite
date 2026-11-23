"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "logo" | "premio" | "portada";

/**
 * Elegir o arrastrar una imagen: se sube sola a R2 y devuelve la dirección.
 * Los logos se muestran enteros sobre fondo claro; las fotos y la portada, recortadas.
 */
export default function ImageUpload({
  value,
  onChange,
  kind,
  label,
  hint,
  className,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  kind: Kind;
  label: string;
  hint?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);

  async function subir(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const r = await fetch("/api/admin/sorteos/subir", { method: "POST", body: fd }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setSubiendo(false);
    if (!r?.ok || !d.url) return setError(d.error || "No se pudo subir la imagen.");
    onChange(d.url);
  }

  const alto = kind === "portada" ? "aspect-[3/1]" : kind === "premio" ? "aspect-[4/3]" : "aspect-[3/2]";

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm font-medium text-[#1a1a1a]">{label}</p>
      <div
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          alto,
          value ? "border-transparent bg-[#f3f4f6]" : "border-[#111827]/15 bg-[#fafafa] hover:border-[#c27b3d]/60",
          encima && "border-[#c27b3d] bg-[#c27b3d]/5",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          subir(e.dataTransfer.files?.[0]);
        }}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- imágenes subidas a R2 */}
            <img
              src={value}
              alt=""
              className={cn("h-full w-full", kind === "logo" ? "object-contain p-4" : "object-cover")}
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                onClick={() => ref.current?.click()}
                className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#111827] shadow"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded-full bg-white/95 p-1.5 text-[#b91c1c] shadow"
                aria-label="Quitar imagen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center text-[#6b7280]"
          >
            <ImagePlus className="h-6 w-6 text-[#c27b3d]" />
            <span className="text-sm font-medium text-[#374151]">Subir imagen</span>
            <span className="text-xs">o arrastrala acá</span>
          </button>
        )}
        {subiendo && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-6 w-6 animate-spin text-[#c27b3d]" />
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          subir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error ? <p className="text-xs text-[#b91c1c]">{error}</p> : hint ? <p className="text-xs text-[#6b7280]">{hint}</p> : null}
    </div>
  );
}
