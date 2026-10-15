"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quitarFirmaEmpresaAction, subirFirmaEmpresaAction } from "@/app/actions/contratos";

const MAX_BYTES = 1024 * 1024;

/** Imagen de la firma de la empresa (PNG o JPG, hasta 1 MB), que va en el PDF del contrato firmado. */
export function FirmaEmpresa({ url }: { url: string | null }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function subir(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const archivo = entrada.current?.files?.[0];
    if (!archivo) return setError("Elegí una imagen.");
    if (archivo.size > MAX_BYTES) return setError("La imagen pesa más de 1 MB.");
    const datos = new FormData();
    datos.set("archivo", archivo);
    iniciar(async () => {
      try {
        const r = await subirFirmaEmpresaAction(datos);
        if (!r.ok) return setError(r.error);
        if (entrada.current) entrada.current.value = "";
        setOk("Firma guardada.");
        router.refresh();
      } catch {
        setError("No pudimos subir la imagen. Probá de nuevo en un rato.");
      }
    });
  }

  function quitar() {
    setError(null);
    setOk(null);
    iniciar(async () => {
      try {
        const r = await quitarFirmaEmpresaAction();
        if (!r.ok) return setError(r.error);
        setOk("Firma quitada.");
        router.refresh();
      } catch {
        setError("No pudimos quitar la imagen. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="firma-empresa-titulo">
      <div className="space-y-1">
        <h2 id="firma-empresa-titulo" className="text-base font-semibold">
          Firma de la empresa
        </h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Imagen de tu firma (PNG o JPG, hasta 1 MB, mejor con fondo blanco o transparente). Aparece en el PDF del contrato firmado, en el lugar de la
          empresa. Se guarda en un almacenamiento privado.
        </p>
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Firma de la empresa" className="max-h-32 rounded-lg border border-[var(--fo-border)] bg-white p-2" />
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no subiste una firma.</p>
      )}
      <form onSubmit={subir} className="flex flex-wrap items-end gap-3">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="ct-firma-archivo">{url ? "Reemplazar la imagen" : "Subir la imagen"}</label>
          <input id="ct-firma-archivo" ref={entrada} type="file" accept="image/png,image/jpeg" className="text-sm" />
        </div>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Subiendo…" : "Subir"}
        </button>
        {url ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={quitar} disabled={pendiente}>
            Quitar
          </button>
        ) : null}
      </form>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">{error}</p>
        ) : ok ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">{ok}</p>
        ) : null}
      </div>
    </section>
  );
}
