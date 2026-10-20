"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { guardarFirma } from "@/lib/ventas/autor";
import { FIRMA_DEMASIADO_GRANDE, FIRMA_LADO_MAX, FIRMA_MAX_BYTES } from "@/lib/ventas/firma-tope";
import { alerta, botonLleno, nota } from "./estilos";

/**
 * Achica la firma en el navegador (lado mayor de 1200 px, JPEG sobre fondo blanco): una acción de
 * servidor no acepta más de 1 MB y una foto de teléfono pesa varios. Si ya es chica, va tal cual.
 */
async function achicar(archivo: File): Promise<Blob> {
  if (archivo.size <= FIRMA_MAX_BYTES && (archivo.type === "image/png" || archivo.type === "image/jpeg")) return archivo;
  const img = await createImageBitmap(archivo);
  const escala = Math.min(1, FIRMA_LADO_MAX / Math.max(img.width, img.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.max(1, Math.round(img.width * escala));
  lienzo.height = Math.max(1, Math.round(img.height * escala));
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Sin lienzo");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  img.close();
  for (const calidad of [0.9, 0.8, 0.65]) {
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
    if (blob && blob.size <= FIRMA_MAX_BYTES) return blob;
  }
  throw new Error(FIRMA_DEMASIADO_GRANDE);
}

/**
 * La firma manuscrita escaneada (D16), una vez para todas tus muestras. Sólo va dentro del
 * certificado: no tiene dirección pública. La vista previa es la del archivo elegido, en tu equipo.
 */
export function FirmaAutor({ cargada }: { cargada: string | null }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [vista, setVista] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);

  useEffect(() => () => {
    if (vista) URL.revokeObjectURL(vista);
  }, [vista]);

  return (
    <form
      className="space-y-3"
      action={(fd) => {
        setError(null);
        setHecho(false);
        start(async () => {
          const original = fd.get("firma");
          if (original instanceof File && original.size > 0) {
            try {
              const chica = await achicar(original);
              fd.set("firma", chica, chica === original ? original.name : "firma.jpg");
            } catch {
              return setError(FIRMA_DEMASIADO_GRANDE);
            }
          }
          const r = await guardarFirma(fd);
          if (!r.ok) return setError(r.errores.join(" "));
          setHecho(true);
          router.refresh();
        });
      }}
    >
      <p className={nota}>
        {cargada ? `Tu firma está cargada (${cargada}). Podés reemplazarla.` : "Firmá en una hoja blanca con tinta oscura, sacale una foto o escaneala y subila: va en cada certificado."}
      </p>
      <input
        type="file"
        name="firma"
        accept="image/png,image/jpeg"
        required
        onChange={(e) => {
          const f = e.target.files?.[0];
          setVista(f ? URL.createObjectURL(f) : null);
        }}
      />
      {vista ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vista} alt="Vista previa de tu firma" className="max-h-28 border border-[var(--mf-line)] bg-white p-2" />
      ) : null}
      <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar mi firma"}</button>
      {error ? <p role="alert" className={alerta}>{error}</p> : null}
      {hecho ? <p role="status" className={nota}>Guardamos tu firma.</p> : null}
    </form>
  );
}
