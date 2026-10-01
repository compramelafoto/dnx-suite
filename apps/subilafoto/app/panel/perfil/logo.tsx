"use client";

import { useRef, useState } from "react";
import { TAMANO_MAXIMO_LOGO, validarLogo } from "@/lib/logo";

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
export function SubirLogo({
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
    const revision = validarLogo({ tipo: archivo.type, bytes: archivo.size });
    if (!revision.ok) {
      setEstado("error");
      setError(revision.motivo ?? "Ese archivo no sirve como logo.");
      return;
    }

    setEstado("subiendo");
    setError(null);
    setVista(URL.createObjectURL(archivo));

    try {
      const permiso = await fetch("/api/panel/logo", {
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
      setError(e instanceof Error ? e.message : "No pudimos subir el logo.");
    }
  }

  return (
    <div>
      <span className="block text-sm font-extrabold">Tu logo</span>

      <input type="hidden" name="logoUrl" value={valor} />
      <input
        ref={entrada}
        id="archivoLogo"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        onChange={(e) => void alElegir(e.target.files?.[0])}
      />

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {vista ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vista}
            alt="Tu logo"
            className="max-h-16 w-auto rounded-lg bg-white p-2"
            style={{ border: "1px solid var(--slf-borde)" }}
          />
        ) : null}

        <label
          htmlFor="archivoLogo"
          className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border-2 px-5 text-sm font-extrabold"
          style={{ borderColor: "var(--slf-violeta)", color: "var(--slf-violeta)" }}
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
          `PNG, JPG, WEBP o SVG, hasta ${Math.round(TAMANO_MAXIMO_LOGO / 1024 / 1024)} MB. Se ve en tu enlace de venta y en la puerta de tus eventos.`}
      </p>
    </div>
  );
}
