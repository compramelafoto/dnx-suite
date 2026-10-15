"use client";

import { useRef, useState } from "react";
import { MEDIDA_SUGERIDA_BANNER, TAMANO_MAXIMO_BANNER, validarBanner } from "@/lib/banner";

/**
 * El proveedor sube su banner desde la ficha.
 *
 * Es lo que recibe a cambio de completarla: su publicidad al pie del teléfono de todos
 * los invitados de la fiesta, rotando con la del fotógrafo. Hasta ahora lo único que
 * recibía era un renglón al pie del álbum, que casi nadie abre.
 *
 * El archivo va **derecho al bucket**, igual que las fotos del invitado: no pasa por el
 * servidor. Lo que viaja en el formulario es la clave, no la imagen.
 */
export function SubirBanner({ token }: { token: string }) {
  const [estado, setEstado] = useState<"quieto" | "subiendo" | "listo">("quieto");
  const [error, setError] = useState<string | null>(null);
  const [clave, setClave] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  async function alElegir(archivo: File | null | undefined) {
    if (!archivo) return;
    setError(null);

    const revision = validarBanner({ tipo: archivo.type, bytes: archivo.size });
    if (!revision.ok) {
      setError(revision.motivo ?? "Ese archivo no sirve.");
      return;
    }

    setEstado("subiendo");
    try {
      const permiso = await fetch(`/api/p/${token}/banner`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: archivo.type, bytes: archivo.size }),
      });
      const datos = (await permiso.json()) as { url?: string; clave?: string; error?: string };
      if (!permiso.ok || !datos.url || !datos.clave) {
        throw new Error(datos.error ?? "No pudimos preparar la subida.");
      }

      const puesta = await fetch(datos.url, {
        method: "PUT",
        headers: { "content-type": archivo.type },
        body: archivo,
      });
      if (!puesta.ok) throw new Error("La subida se cortó. Probá de nuevo.");

      setClave(datos.clave);
      setEstado("listo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos subir el banner.");
      setEstado("quieto");
    }
  }

  const topeMb = Math.round(TAMANO_MAXIMO_BANNER / 1024 / 1024);

  return (
    <div>
      {/* Lo que viaja con el formulario es la clave, no la imagen. */}
      <input type="hidden" name="bannerUrl" value={clave} />

      <input
        ref={entrada}
        id="banner"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void alElegir(e.target.files?.[0])}
      />

      <label
        htmlFor="banner"
        className="inline-flex min-h-[48px] cursor-pointer items-center rounded-xl px-5 text-sm font-extrabold"
        style={{ border: "1px solid var(--slf-borde)" }}
      >
        {estado === "subiendo"
          ? "Subiendo…"
          : estado === "listo"
            ? "Cambiar el banner"
            : "Elegir mi banner"}
      </label>

      <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }} aria-live="polite">
        {error ??
          (estado === "listo"
            ? "Listo. Va a aparecer al pie del teléfono de los invitados."
            : `Opcional. Ideal ${MEDIDA_SUGERIDA_BANNER.ancho} × ${MEDIDA_SUGERIDA_BANNER.alto} px (una franja apaisada). JPG, PNG o WEBP, hasta ${topeMb} MB.`)}
      </p>
    </div>
  );
}
