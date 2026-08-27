"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoGuide } from "@/components/membership/photo-guide";

type Estado = "idle" | "subiendo" | "error";

/**
 * Carga de la foto del socio, desde su portal.
 *
 * Sube contra `/api/portal/foto`, que resuelve la ficha desde la sesión: el socio solo puede
 * tocar su propia foto. El endpoint general de imágenes no sirve acá porque exige ser del
 * equipo administrativo, y un socio no lo es.
 */
export function MemberPhotoUpload({ currentUrl }: { currentUrl: string | null }) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(currentUrl);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function subir(file: File) {
    setEstado("subiendo");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/portal/foto", { method: "POST", body });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "No pudimos subir la foto. Probá de nuevo.");
        setEstado("error");
        return;
      }
      setUrl(data.url);
      setEstado("idle");
      // La foto se usa en el carnet: al volver a pintar la pantalla se ve con la nueva.
      router.refresh();
    } catch {
      setError("No pudimos subir la foto. Revisá tu conexión.");
      setEstado("error");
    }
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Tu foto</h2>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          {url
            ? "Es la que sale en tu credencial. Podés cambiarla cuando quieras."
            : "Todavía no cargaste tu foto. Es la que va a salir en tu credencial."}
        </p>
      </div>

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- la foto vive en R2, fuera del build
        <img
          src={url}
          alt="Tu foto de socio"
          className="h-32 w-32 rounded-lg border border-[var(--fo-border)] object-cover"
        />
      ) : (
        <PhotoGuide />
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void subir(file);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={estado === "subiendo"}
          className="fo-btn fo-btn-secondary text-sm"
        >
          {estado === "subiendo" ? "Subiendo…" : url ? "Cambiar la foto" : "Subir mi foto"}
        </button>
        {url ? (
          <span className="text-xs text-[var(--fo-muted)]">Cuadrada, mínimo 472 × 472.</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
    </section>
  );
}
