"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PaginaATamano } from "../../pagina-a-tamano";
import { registrarImpresionesAction } from "@/app/(shell)/ventas/impresion/actions";
import { decisionAlMontar } from "@/lib/impresion/hoja-prueba";
import { paginas, registrosDeRespuesta, type HojaAImprimir, type RegistroDeHoja } from "@/lib/impresion/impresion-multiple";

type Fase = "cargando" | "imprimiendo" | "preguntar" | "detalle" | "guardando" | "listo" | "error";

/**
 * Imprime una tanda de páginas (todas las hojas, o sólo las que salieron mal) y después pregunta
 * "¿Cómo salió?": todas bien, o cuántas copias de cada hoja salieron mal. Las malas se registran
 * DESCARTADA y se vuelven a imprimir solas.
 */
export function HojasParaImprimir({
  preparacionId,
  hojas,
  faltan,
  anchoMm,
  altoMm,
  paginaAnchoMm,
  paginaAltoMm,
  titulo,
}: {
  preparacionId: string;
  hojas: HojaAImprimir[];
  faltan: number;
  /** Con la corrección de escala de la impresora. */
  anchoMm: number;
  altoMm: number;
  paginaAnchoMm: number;
  paginaAltoMm: number;
  titulo: string;
}) {
  const [tanda, setTanda] = useState<HojaAImprimir[]>(hojas);
  const [ronda, setRonda] = useState(0);
  const [fase, setFase] = useState<Fase>("cargando");
  const faseRef = useRef<Fase>("cargando");
  const [malas, setMalas] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [reintento, setReintento] = useState<{ registros: RegistroDeHoja[]; reimprimir: HojaAImprimir[] } | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const cargadas = useRef(new Set<string>());
  const lista = useMemo(() => paginas(tanda), [tanda]);

  function cambiarFase(f: Fase) {
    faseRef.current = f;
    setFase(f);
  }
  function imprimir() {
    cambiarFase("imprimiendo");
    // Un tick para que React pinte antes de que el diálogo bloquee la pestaña.
    setTimeout(() => window.print(), 50);
  }
  function alFallar() {
    setError("No se pudo cargar una de las hojas.");
    cambiarFase("error");
  }
  function alCargar(clave: string) {
    cargadas.current.add(clave);
    if (cargadas.current.size >= lista.length && faseRef.current === "cargando") imprimir();
  }

  useEffect(() => {
    const despues = () => {
      if (faseRef.current === "imprimiendo") cambiarFase("preguntar");
    };
    window.addEventListener("afterprint", despues);
    return () => window.removeEventListener("afterprint", despues);
  }, []);

  // En cada tanda: las imágenes que ya estaban en caché cargaron antes de hidratar y su onLoad no llega.
  useEffect(() => {
    cargadas.current = new Set();
    for (const img of Array.from(contenedor.current?.querySelectorAll<HTMLImageElement>("img[data-clave]") ?? [])) {
      const d = decisionAlMontar(img.complete, img.naturalWidth, faseRef.current === "cargando" ? "cargando" : "otra");
      if (d === "error") alFallar();
      else if (img.complete && img.naturalWidth > 0) alCargar(img.dataset.clave!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sólo al cambiar de tanda
  }, [ronda]);

  async function registrar(registros: RegistroDeHoja[], reimprimir: HojaAImprimir[]) {
    cambiarFase("guardando");
    setError(null);
    try {
      const r = await registrarImpresionesAction(preparacionId, registros);
      if (!r.ok) {
        setError(r.error);
        setReintento({ registros, reimprimir });
        return cambiarFase("error");
      }
    } catch {
      setError("No se pudo guardar. Revisá la conexión y probá de nuevo.");
      setReintento({ registros, reimprimir });
      return cambiarFase("error");
    }
    setReintento(null);
    setMalas({});
    if (reimprimir.length === 0) return cambiarFase("listo");
    // Las que salieron mal, de nuevo: otra tanda sólo con esas páginas.
    setTanda(reimprimir);
    setRonda((n) => n + 1);
    cambiarFase("cargando");
  }

  function responder(conMalas: Record<string, number>) {
    const x = registrosDeRespuesta(tanda, conMalas);
    void registrar(x.registros, x.reimprimir);
  }

  return (
    <div>
      <div className="no-imprimir mx-auto max-w-xl space-y-3 p-4 text-sm">
        <p className="font-medium">{titulo}</p>
        <details>
          <summary className="cursor-pointer underline">Descargar los JPG (para imprimir desde otro programa)</summary>
          <ul className="mt-1 list-disc pl-5">
            {hojas.map((h, i) => (
              <li key={h.hojaId}>
                <a className="underline" href={`/api/impresion/hoja/${h.hojaId}?descargar=1&v=${h.version}`}>
                  Hoja {i + 1} · {h.copias} {h.copias === 1 ? "copia" : "copias"}
                </a>
              </li>
            ))}
          </ul>
        </details>
        {faltan > 0 ? (
          <p className="fo-alert-warning">
            Faltan armar {faltan} {faltan === 1 ? "foto" : "fotos"}: no están en esta impresión.
          </p>
        ) : null}
        {fase === "cargando" ? (
          <div className="flex gap-2">
            <span>Cargando {lista.length} {lista.length === 1 ? "página" : "páginas"}…</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={imprimir}>
              Imprimir
            </button>
          </div>
        ) : null}
        {fase === "preguntar" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>¿Cómo salió?</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={() => responder({})}>
              Todas bien
            </button>
            <button type="button" className="fo-btn fo-btn-primary" onClick={() => cambiarFase("detalle")}>
              Alguna salió mal
            </button>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => cambiarFase("listo")}>
              No las imprimí
            </button>
          </div>
        ) : null}
        {fase === "detalle" ? (
          <div className="space-y-3">
            <p>Marcá cuántas copias de cada hoja salieron mal: se descartan y se vuelven a imprimir sólo esas.</p>
            <ul className="space-y-2">
              {tanda.map((h, i) => (
                <li key={h.hojaId} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura del archivo privado de la hoja */}
                  <img src={`/api/impresion/hoja/${h.hojaId}?v=${h.version}`} alt="" className="h-16 w-auto border border-[var(--fo-border)]" />
                  <span className="flex-1">
                    Hoja {i + 1} · {h.copias} {h.copias === 1 ? "copia" : "copias"}
                  </span>
                  <label className="flex items-center gap-1">
                    Mal
                    <input
                      type="number"
                      min={0}
                      max={h.copias}
                      value={malas[h.hojaId] ?? 0}
                      onChange={(e) => setMalas((m) => ({ ...m, [h.hojaId]: Math.min(h.copias, Math.max(0, Math.round(Number(e.target.value)) || 0)) }))}
                      className="fo-input h-8 w-16"
                    />
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button type="button" className="fo-btn fo-btn-primary" onClick={() => responder(malas)}>
                Guardar y reimprimir las malas
              </button>
              <button type="button" className="fo-btn fo-btn-secondary" onClick={() => cambiarFase("preguntar")}>
                Volver
              </button>
            </div>
          </div>
        ) : null}
        {fase === "guardando" ? <p>Guardando…</p> : null}
        {fase === "listo" ? (
          <div className="flex gap-2">
            <span>Listo.</span>
            <button type="button" className="fo-btn fo-btn-primary" onClick={imprimir}>
              Imprimir otra vez
            </button>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => window.close()}>
              Cerrar
            </button>
          </div>
        ) : null}
        {fase === "error" ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[var(--fo-danger)]">{error}</p>
            {reintento ? (
              <button type="button" className="fo-btn fo-btn-primary" onClick={() => void registrar(reintento.registros, reintento.reimprimir)}>
                Reintentar
              </button>
            ) : (
              <button type="button" className="fo-btn fo-btn-secondary" onClick={() => window.location.reload()}>
                Recargar la página
              </button>
            )}
          </div>
        ) : null}
      </div>
      {/* Cada página es de tamaño fijo: con una escala mayor a 1000 la imagen se recorta, no pasa a otra hoja. */}
      <div ref={contenedor}>
        {lista.map((p, i) => (
          <PaginaATamano
            key={`${ronda}-${i}`}
            className="pagina"
            clave={`${ronda}-${i}`}
            src={`/api/impresion/hoja/${p.hojaId}?v=${p.version}`}
            anchoMm={anchoMm}
            altoMm={altoMm}
            paginaAnchoMm={paginaAnchoMm}
            paginaAltoMm={paginaAltoMm}
            onLoad={() => alCargar(`${ronda}-${i}`)}
            onError={alFallar}
          />
        ))}
      </div>
    </div>
  );
}
