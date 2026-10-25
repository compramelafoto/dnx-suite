"use client";

import { useEffect, useRef, useState } from "react";
import { registrarImpresionAction } from "@/app/(shell)/ventas/impresion/actions";
import { decisionAlMontar } from "@/lib/impresion/hoja-prueba";
import { PaginaATamano } from "../../pagina-a-tamano";

type Fase = "cargando" | "imprimiendo" | "preguntar" | "guardando" | "listo" | "error";
type Respuesta = "NORMAL" | "DESCARTADA";

export function HojaParaImprimir({
  hojaId, src, anchoMm, altoMm, paginaAnchoMm, paginaAltoMm, copias, titulo,
}: {
  /** Con `?v=`: la versión de la hoja, para que el navegador no muestre una vieja de la caché. */
  hojaId: string; src: string; anchoMm: number; altoMm: number;
  paginaAnchoMm: number; paginaAltoMm: number; copias: number; titulo: string;
}) {
  const [fase, setFase] = useState<Fase>("cargando");
  const [error, setError] = useState<string | null>(null);
  const faseRef = useRef<Fase>("cargando");
  const imgRef = useRef<HTMLImageElement>(null);
  const [ultima, setUltima] = useState<Respuesta | null>(null);

  useEffect(() => { faseRef.current = fase; }, [fase]);

  function imprimir() {
    setFase("imprimiendo");
    faseRef.current = "imprimiendo";
    // Un tick para que React pinte antes de que el diálogo bloquee la pestaña.
    setTimeout(() => window.print(), 50);
  }

  useEffect(() => {
    const despues = () => { if (faseRef.current === "imprimiendo") setFase("preguntar"); };
    window.addEventListener("afterprint", despues);
    // Si la imagen ya estaba en caché, cargó antes de hidratar y onLoad nunca llega.
    const img = imgRef.current;
    const t = setTimeout(() => {
      if (!img) return;
      const d = decisionAlMontar(img.complete, img.naturalWidth, faseRef.current);
      if (d === "imprimir") imprimir();
      if (d === "error") { setError("No se pudo cargar la hoja."); setFase("error"); }
    }, 0);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", despues); };
  }, []);

  async function responder(motivo: Respuesta | null) {
    if (motivo === null) return setFase("listo");
    setUltima(motivo);
    setFase("guardando");
    try {
      const r = await registrarImpresionAction(hojaId, { motivo, hojas: copias });
      if (!r.ok) { setError(r.error); return setFase("error"); }
    } catch {
      setError("No se pudo guardar. Revisá la conexión y probá de nuevo.");
      return setFase("error");
    }
    if (motivo === "DESCARTADA") return imprimir();
    setFase("listo");
  }

  return (
    <div>
      <div className="no-imprimir mx-auto max-w-xl space-y-3 p-4 text-sm">
        <p className="font-medium">{titulo}</p>
        {fase === "cargando" ? (
          <div className="flex gap-2">
            <span>Cargando la hoja…</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={imprimir}>Imprimir</button>
          </div>
        ) : null}
        {fase === "preguntar" ? (
          <div className="flex flex-wrap gap-2">
            <span>¿Cómo salió?</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={() => responder("NORMAL")}>Salió bien</button>
            <button type="button" className="fo-btn fo-btn-primary" onClick={() => responder("DESCARTADA")}>Salió mal, reimprimir</button>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => responder(null)}>No la imprimí</button>
          </div>
        ) : null}
        {fase === "listo" ? (
          <div className="flex gap-2">
            <span>Listo.</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={imprimir}>Imprimir otra vez</button>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => window.close()}>Cerrar</button>
          </div>
        ) : null}
        {fase === "error" ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[var(--fo-danger)]">{error}</p>
            {ultima ? <button type="button" className="fo-btn fo-btn-primary" onClick={() => responder(ultima)}>Reintentar</button> : null}
          </div>
        ) : null}
        <a className="underline" href={`${src}&descargar=1`}>Descargar JPG</a>
      </div>
      <PaginaATamano
        imgRef={imgRef}
        src={src}
        anchoMm={anchoMm}
        altoMm={altoMm}
        paginaAnchoMm={paginaAnchoMm}
        paginaAltoMm={paginaAltoMm}
        onLoad={() => { if (faseRef.current === "cargando") imprimir(); }}
        onError={() => { setError("No se pudo cargar la hoja."); setFase("error"); }}
      />
    </div>
  );
}
