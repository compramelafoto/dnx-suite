"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { guardarFirma } from "@/lib/ventas/autor";
import { alerta, botonLleno, nota } from "./estilos";

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
