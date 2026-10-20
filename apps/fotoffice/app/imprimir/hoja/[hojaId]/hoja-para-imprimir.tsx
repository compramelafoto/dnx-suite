"use client";

import { useEffect, useRef, useState } from "react";
import { registrarImpresionAction } from "@/app/(shell)/ventas/impresion/actions";

type Fase = "cargando" | "imprimiendo" | "preguntar" | "guardando" | "listo" | "error";

export function HojaParaImprimir({ hojaId, src, anchoMm, altoMm, copias, titulo }: { hojaId: string; src: string; anchoMm: number; altoMm: number; copias: number; titulo: string }) {
  const [fase, setFase] = useState<Fase>("cargando");
  const [error, setError] = useState<string | null>(null);
  const faseRef = useRef<Fase>("cargando");

  useEffect(() => { faseRef.current = fase; }, [fase]);

  useEffect(() => {
    const despues = () => { if (faseRef.current === "imprimiendo") setFase("preguntar"); };
    window.addEventListener("afterprint", despues);
    return () => window.removeEventListener("afterprint", despues);
  }, []);

  function imprimir() {
    setFase("imprimiendo");
    // Un tick para que React pinte antes de que el diálogo bloquee la pestaña.
    setTimeout(() => window.print(), 50);
  }

  async function responder(motivo: "NORMAL" | "DESCARTADA" | null) {
    if (motivo === null) return setFase("listo");
    setFase("guardando");
    const r = await registrarImpresionAction(hojaId, { motivo, hojas: copias });
    if (!r.ok) { setError(r.error); return setFase("error"); }
    if (motivo === "DESCARTADA") return imprimir();
    setFase("listo");
  }

  return (
    <div>
      <div className="no-imprimir mx-auto max-w-xl space-y-3 p-4 text-sm">
        <p className="font-medium">{titulo}</p>
        {fase === "preguntar" ? (
          <div className="flex flex-wrap gap-2">
            <span>¿Cómo salió?</span>
            <button className="fo-btn fo-btn-primary" onClick={() => responder("NORMAL")}>Salió bien</button>
            <button className="fo-btn" onClick={() => responder("DESCARTADA")}>Salió mal, reimprimir</button>
            <button className="fo-btn" onClick={() => responder(null)}>No la imprimí</button>
          </div>
        ) : null}
        {fase === "listo" ? (
          <div className="flex gap-2">
            <span>Listo.</span>
            <button className="fo-btn" onClick={imprimir}>Imprimir otra vez</button>
            <button className="fo-btn" onClick={() => window.close()}>Cerrar</button>
          </div>
        ) : null}
        {fase === "error" ? <p className="text-[var(--fo-danger)]">{error}</p> : null}
        <a className="underline" href={`${src}?descargar=1`}>Descargar JPG</a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- el tamaño en mm es el punto: no se optimiza */}
      <img
        src={src}
        alt=""
        onLoad={() => { if (faseRef.current === "cargando") imprimir(); }}
        onError={() => { setError("No se pudo cargar la hoja."); setFase("error"); }}
        style={{ width: `${anchoMm}mm`, height: `${altoMm}mm`, display: "block" }}
      />
    </div>
  );
}
