"use client";

import { useState } from "react";
import { Check, Download, FileImage } from "lucide-react";
import type { Receta } from "@/lib/impresion/receta";
import { prepararArchivoCarnetAction } from "@/app/(shell)/ventas/impresion/actions";
import { EnviarPorMail } from "./enviar-por-mail";

type Pieza = { originalId: string; anchoMm: number; altoMm: number; receta: Receta };

const TEXTO_AVISO = {
  BLANDA: "La foto tiene poca resolución para esta medida: puede verse un poco blanda.",
  PIXELADA: "La foto tiene muy poca resolución para esta medida: se va a ver pixelada. Conviene sacar otra.",
} as const;

/**
 * Paso 4 del producto "Archivo digital": no hay plancha ni impresora. El servidor guarda la receta
 * y entrega la foto sola a 300 ppp, para descargarla o mandarla por mail. En el ticket cuenta 1.
 * `inicial`: la preparación ya tenía la foto guardada (se reabre con «Editar fotos»).
 */
export function PasoArchivo({
  preparacionId,
  pieza,
  emailInicial,
  inicial,
  onListo,
}: {
  preparacionId: string;
  pieza: Pieza;
  emailInicial: string | null;
  inicial: { ppp: number; aviso: "OK" | "BLANDA" | "PIXELADA" } | null;
  onListo: () => void;
}) {
  const [lista, setLista] = useState<{ version: number; ppp: number; aviso: "OK" | "BLANDA" | "PIXELADA" } | null>(
    inicial ? { version: 0, ...inicial } : null,
  );
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function armar() {
    setArmando(true);
    setError(null);
    try {
      const g = await prepararArchivoCarnetAction(preparacionId, pieza);
      if (!g.ok) return setError(g.error);
      setLista({ version: Date.now(), ppp: g.ppp, aviso: g.aviso });
    } catch {
      setError("No se pudo armar la foto. Probá de nuevo.");
    } finally {
      setArmando(false);
    }
  }

  const src = `/api/impresion/archivo/${preparacionId}?v=${lista?.version ?? 0}`;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {lista ? (
        <div className="flex justify-center rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- la foto sale de una ruta privada, sin optimizar */}
          <img src={src} alt="La foto carnet como queda en el archivo" className="max-h-72 w-auto shadow-sm" />
        </div>
      ) : (
        <div className="flex min-h-48 items-center justify-center rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border)] p-6 text-center text-sm text-[var(--fo-muted)]">
          {armando ? "Armando la foto desde el original…" : "Tocá «Armar archivo» para ver la foto tal como se entrega."}
        </div>
      )}

      <div className="space-y-4">
        <p className="text-sm text-[var(--fo-muted)]">
          Se entrega como archivo digital: no se imprime ni gasta hoja. La foto sale sola, a la medida del trámite y a 300 ppp.
        </p>
        <button type="button" className="fo-btn fo-btn-primary w-full" disabled={armando} onClick={() => void armar()}>
          <FileImage className="size-4" aria-hidden />
          {armando ? "Armando…" : lista ? "Volver a armar" : "Armar archivo"}
        </button>
        {error ? <p className="fo-alert-error">{error}</p> : null}

        {lista ? (
          <div className="space-y-3">
            {lista.aviso !== "OK" ? (
              <p className="fo-alert-warning">
                {TEXTO_AVISO[lista.aviso]} ({lista.ppp} ppp efectivos)
              </p>
            ) : null}
            <a className="fo-btn fo-btn-secondary w-full" href={`${src}&descargar=1`}>
              <Download className="size-4" aria-hidden />
              Descargar JPG
            </a>
            <EnviarPorMail preparacionId={preparacionId} emailInicial={emailInicial} />
            <button type="button" className="fo-btn fo-btn-primary w-full" onClick={onListo}>
              <Check className="size-4" aria-hidden />
              Listo
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
