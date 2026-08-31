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
export type TipoDeFoto = "CARNET" | "PERFIL";

export function MemberPhotoUpload({
  currentUrl,
  tipo = "CARNET",
  /** La del carnet, para poder ofrecer "usar la misma" en el perfil. */
  carnetUrl = null,
}: {
  currentUrl: string | null;
  tipo?: TipoDeFoto;
  carnetUrl?: string | null;
}) {
  const esPerfil = tipo === "PERFIL";
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
      body.append("tipo", tipo);
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

  /** Volver a la del carnet es borrar la propia: vacío significa "usar la del carnet". */
  async function quitar() {
    setEstado("subiendo");
    setError(null);
    try {
      const res = await fetch("/api/portal/foto?tipo=PERFIL", { method: "DELETE" });
      if (!res.ok) {
        setError("No pudimos quitar la foto. Probá de nuevo.");
        setEstado("error");
        return;
      }
      setUrl(null);
      setEstado("idle");
      router.refresh();
    } catch {
      setError("No pudimos quitar la foto. Revisá tu conexión.");
      setEstado("error");
    }
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">
          {esPerfil ? "Tu foto de perfil" : "La foto de tu credencial"}
        </h2>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          {esPerfil
            ? "Es la que te representa en el portal. Elegila vos: puede ser la misma de la credencial o cualquier otra donde te guste cómo salís."
            : url
              ? "Es la que sale impresa en tu credencial: fondo plano y encuadre de documento. La revisa la Secretaría."
              : "Todavía no la cargaste. Es la que va a salir impresa en tu credencial, así que tiene requisitos."}
        </p>
      </div>

      {/* Redonda en el perfil y cuadrada en el carnet: cada una se muestra como se va a usar. */}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- la foto vive en R2, fuera del build
        <img
          src={url}
          alt={esPerfil ? "Tu foto de perfil" : "La foto de tu credencial"}
          className={
            esPerfil
              ? "h-24 w-24 rounded-full border border-[var(--fo-border)] object-cover"
              : "h-32 w-32 rounded-lg border border-[var(--fo-border)] object-cover"
          }
        />
      ) : esPerfil ? (
        <p className="text-xs text-[var(--fo-muted)]">
          {carnetUrl
            ? "Mientras no elijas una, se usa la de tu credencial."
            : "Mientras no haya ninguna, en el portal se muestran tus iniciales."}
        </p>
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
          {estado === "subiendo"
            ? "Subiendo…"
            : url
              ? "Cambiar la foto"
              : esPerfil
                ? "Elegir una foto"
                : "Subir mi foto"}
        </button>
        {esPerfil && url ? (
          <button
            type="button"
            onClick={() => void quitar()}
            disabled={estado === "subiendo"}
            className="text-xs text-[var(--fo-muted)] underline underline-offset-2 hover:text-[var(--fo-text)]"
          >
            {carnetUrl ? "Usar la de mi credencial" : "Quitar la foto"}
          </button>
        ) : null}
        {!esPerfil && url ? (
          <span className="text-xs text-[var(--fo-muted)]">Cuadrada, mínimo 472 × 472.</span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
    </section>
  );
}
