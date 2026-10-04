"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Estado = "idle" | "subiendo" | "error";

/**
 * Carga del logo de la empresa del socio, desde su portal.
 *
 * Sube contra `/api/portal/logo`, que resuelve la ficha desde la sesión. Se muestra entero
 * (`object-contain`) sobre fondo claro: un logo recortado deja de ser el logo.
 */
export function BusinessLogoUpload({
  currentUrl,
  businessName,
}: {
  currentUrl: string | null;
  businessName: string | null;
}) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(currentUrl);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function enviar(init: RequestInit, alFallar: string) {
    setEstado("subiendo");
    setError(null);
    try {
      const res = await fetch("/api/portal/logo", init);
      const data = (await res.json()) as { url?: string; ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? alFallar);
        setEstado("error");
        return;
      }
      setUrl(data.url ?? null);
      setEstado("idle");
      router.refresh();
    } catch {
      setError(`${alFallar} Revisá tu conexión.`);
      setEstado("error");
    }
  }

  function subir(file: File) {
    const body = new FormData();
    body.append("file", file);
    void enviar({ method: "POST", body }, "No pudimos subir el logo.");
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">El logo de tu empresa</h2>
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          {businessName
            ? `Se muestra en tu portal junto a ${businessName}.`
            : "Se muestra en tu portal junto al nombre de tu estudio. Cargá el nombre más abajo, en tu perfil profesional."}
        </p>
      </div>

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2, fuera del build
        <img
          src={url}
          alt="Logo de tu empresa"
          className="h-24 w-40 rounded-lg border border-[var(--fo-border)] bg-white object-contain p-2"
        />
      ) : (
        <p className="text-xs text-[var(--fo-muted)]">
          PNG con fondo transparente si lo tenés; si no, JPG. Mínimo 120 × 120.
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) subir(file);
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
          {estado === "subiendo" ? "Subiendo…" : url ? "Cambiar el logo" : "Subir el logo"}
        </button>
        {url ? (
          <button
            type="button"
            onClick={() => void enviar({ method: "DELETE" }, "No pudimos quitar el logo.")}
            disabled={estado === "subiendo"}
            className="text-xs text-[var(--fo-muted)] underline underline-offset-2 hover:text-[var(--fo-text)]"
          >
            Quitar el logo
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
    </section>
  );
}
