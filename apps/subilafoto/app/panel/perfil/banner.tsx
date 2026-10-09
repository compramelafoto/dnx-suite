"use client";

import { useRef, useState } from "react";
import { TAMANO_MAXIMO_BANNER, validarBanner } from "@/lib/banner";

/**
 * Subir el logo.
 *
 * El archivo va **derecho al bucket** con una dirección firmada, igual que las fotos de
 * los invitados. Lo que viaja al formulario es la clave, en un campo oculto: el guardado
 * final lo hace la acción del perfil, así que subir un logo y no guardar no cambia nada.
 *
 * La vista previa se arma con `URL.createObjectURL` y no esperando a que el archivo
 * termine de subir: el fotógrafo ve su logo en el momento en que lo elige.
 */
export function SubirBanner({
  valorInicial,
  vistaPreviaInicial,
}: {
  valorInicial: string;
  vistaPreviaInicial: string | null;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState(valorInicial);
  const [vista, setVista] = useState<string | null>(vistaPreviaInicial);
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "error">("quieto");
  const [error, setError] = useState<string | null>(null);

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return;

    // La misma revisión que hace el servidor, antes de gastar una subida.
    const revision = validarBanner({ tipo: archivo.type, bytes: archivo.size });
    if (!revision.ok) {
      setEstado("error");
      setError(revision.motivo ?? "Ese archivo no sirve como banner.");
      return;
    }

    setEstado("subiendo");
    setError(null);
    setVista(URL.createObjectURL(archivo));

    try {
      const permiso = await fetch("/api/panel/banner", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: archivo.type, bytes: archivo.size }),
      });
      const datos = await permiso.json();
      if (!permiso.ok) throw new Error(datos.error ?? "No pudimos preparar la subida.");

      const puesta = await fetch(datos.url, {
        method: "PUT",
        headers: { "content-type": archivo.type },
        body: archivo,
      });
      if (!puesta.ok) throw new Error("La subida se cortó. Probá de nuevo.");

      setValor(datos.clave);
      setEstado("quieto");
    } catch (e) {
      setEstado("error");
      setError(e instanceof Error ? e.message : "No pudimos subir el banner.");
    }
  }

  return (
    <div>
      <span className="block text-sm font-extrabold">Tu banner de publicidad</span>

      <input type="hidden" name="bannerUrl" value={valor} />
      <input
        ref={entrada}
        id="archivoBanner"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void alElegir(e.target.files?.[0])}
      />

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vista}
            alt="Tu banner de publicidad"
            className="max-h-24 w-full rounded-lg object-contain"
            style={{ border: "1px solid var(--slf-borde)" }}
          />
        ) : null}

        <label
          htmlFor="archivoBanner"
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border-2 px-5 text-sm font-extrabold"
          style={{ borderColor: "var(--slf-violeta)", color: "var(--slf-violeta-texto)" }}
        >
          {estado === "subiendo" ? "Subiendo…" : vista ? "Cambiar" : "Elegir archivo"}
        </label>

        {vista ? (
          <button
            type="button"
            onClick={() => {
              setValor("");
              setVista(null);
              if (entrada.current) entrada.current.value = "";
            }}
            className="inline-flex min-h-[44px] items-center text-sm font-extrabold underline underline-offset-4"
            style={{ color: "var(--slf-tinta-suave)" }}
          >
            Quitar
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }} aria-live="polite">
        {error ??
          `JPG, PNG o WEBP, hasta ${Math.round(TAMANO_MAXIMO_BANNER / 1024 / 1024)} MB. Se ve al pie de la pantalla de tus invitados, en todos tus eventos.`}
      </p>
    </div>
  );
}
