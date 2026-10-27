"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Download, LayoutGrid, Printer } from "lucide-react";
import { disposicionCarnet } from "@/lib/impresion/plancha";
import type { Receta } from "@/lib/impresion/receta";
import { generarHojaCarnetAction, guardarPiezaCarnetAction } from "@/app/(shell)/ventas/impresion/actions";
import type { ModoEditorFotoCarnet } from "./editor-foto-carnet";
import { VistaHoja } from "./vistas";
import { EnviarPorMail } from "./enviar-por-mail";

const HOJAS_MAX = 50;

type Pieza = { originalId: string; anchoMm: number; altoMm: number; receta: Receta };
type Armada = {
  firma: string;
  hojaId: string;
  fotosPorHoja: number;
  /** La versión del archivo (la da el servidor): va en la URL de la imagen, que se cachea. */
  version: string;
  aviso: "OK" | "BLANDA" | "PIXELADA";
  ppp: number;
};

const TEXTO_AVISO = {
  BLANDA: "La foto tiene poca resolución para esta medida: puede salir un poco blanda.",
  PIXELADA: "La foto tiene muy poca resolución para esta medida: va a salir pixelada. Conviene sacar otra.",
} as const;

/** La firma de lo pedido: si cambia algo, la hoja que se ve ya no es la vigente. */
function firmaDe(d: { pieza: Pieza; salida?: string; tamano?: string; fotos: number | null; copias: number }): string {
  return JSON.stringify({ pieza: d.pieza, salida: d.salida, tamano: d.tamano, fotos: d.fotos, copias: d.copias });
}

/**
 * Paso 4: el servidor guarda la receta y arma la hoja desde el original. En la pantalla suelta se
 * elige la impresora y la hoja; en el Mostrador salen del producto. `inicial` es la hoja ya armada
 * de una preparación que se reabre: se muestra sin volver a armarla.
 */
export function PasoPlancha({
  modo,
  preparacionId,
  pieza,
  emailInicial = null,
  inicial = null,
}: {
  modo: ModoEditorFotoCarnet;
  preparacionId: string;
  pieza: Pieza;
  /** El mail de la ficha del cliente, para mandarle la foto (sola, sin plancha). */
  emailInicial?: string | null;
  inicial?: { id: string; fotosPorHoja: number; copias: number; version: string; ppp: number; aviso: Armada["aviso"] } | null;
}) {
  const salidas = modo.tipo === "suelto" ? modo.salidas : [];
  const [salidaId, setSalidaId] = useState(salidas[0]?.id ?? "");
  const salida = salidas.find((s) => s.id === salidaId) ?? null;
  const [tamanoElegido, setTamanoElegido] = useState(salidas[0]?.tamanos[0]?.id ?? "");
  const tamano = salida?.tamanos.find((t) => t.id === tamanoElegido) ?? salida?.tamanos[0] ?? null;
  const [copias, setCopias] = useState(inicial?.copias ?? 1);
  const [armando, setArmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armada, setArmada] = useState<Armada | null>(() =>
    // Sólo en el Mostrador (la impresora y la hoja salen del producto): la firma es la de lo guardado.
    inicial && modo.tipo === "mostrador"
      ? { firma: firmaDe({ pieza, fotos: null, copias: inicial.copias }), hojaId: inicial.id, fotosPorHoja: inicial.fotosPorHoja, version: inicial.version, aviso: inicial.aviso, ppp: inicial.ppp }
      : null,
  );

  const entran =
    salida && tamano
      ? disposicionCarnet({ anchoMm: pieza.anchoMm, altoMm: pieza.altoMm }, tamano, salida.ppp).posiciones.length
      : 0;
  // La cantidad por hoja no se elige: son las que entran según la medida, con tope de 6.
  const firma = firmaDe({ pieza, salida: salida?.id, tamano: tamano?.id, fotos: null, copias });
  const vigente = armada?.firma === firma ? armada : null;
  const puedeArmar = modo.tipo === "mostrador" || (salida !== null && tamano !== null && entran > 0);

  async function armar() {
    setArmando(true);
    setError(null);
    try {
      const g = await guardarPiezaCarnetAction(preparacionId, pieza);
      if (!g.ok) return setError(g.error);
      const h = await generarHojaCarnetAction(preparacionId, {
        salidaId: modo.tipo === "suelto" ? (salida?.id ?? null) : null,
        tamanoId: modo.tipo === "suelto" ? (tamano?.id ?? null) : null,
        fotos: null,
        copias,
        conLineas: true,
      });
      if (!h.ok) return setError(h.error);
      setArmada({ firma, hojaId: h.hojaId, fotosPorHoja: h.fotosPorHoja, version: h.version, aviso: g.aviso, ppp: g.ppp });
    } catch {
      setError("No se pudo armar la plancha. Probá de nuevo.");
    } finally {
      setArmando(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {vigente ? (
        <VistaHoja hojaId={vigente.hojaId} version={vigente.version} fotos={vigente.fotosPorHoja} />
      ) : (
        <div className="flex min-h-48 items-center justify-center rounded-[var(--fo-radius-sm)] border border-dashed border-[var(--fo-border)] p-6 text-center text-sm text-[var(--fo-muted)]">
          {armando ? "Armando la plancha desde la foto original…" : "Tocá «Armar plancha» para ver la hoja tal como se imprime."}
        </div>
      )}

      <div className="space-y-4">
        {modo.tipo === "suelto" ? (
          salidas.length === 0 ? (
            <p className="fo-alert-warning">
              No hay impresoras configuradas. Cargalas en <Link className="underline" href="/ventas/impresion/configuracion">Impresión → Configuración</Link>.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="fo-label">Impresora</span>
                <select
                  className="fo-input"
                  value={salida?.id ?? ""}
                  onChange={(e) => {
                    setSalidaId(e.target.value);
                    setTamanoElegido(salidas.find((s) => s.id === e.target.value)?.tamanos[0]?.id ?? "");
                  }}
                >
                  {salidas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="fo-label">Hoja</span>
                <select className="fo-input" value={tamano?.id ?? ""} onChange={(e) => setTamanoElegido(e.target.value)}>
                  {(salida?.tamanos ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )
        ) : (
          <div className="space-y-1">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="fo-label">Impresora</dt>
                <dd className="font-medium">{modo.produccion.salida || "—"}</dd>
              </div>
              <div>
                <dt className="fo-label">Hoja</dt>
                <dd className="font-medium">{modo.produccion.hoja || "—"}</dd>
              </div>
            </dl>
            <p className="text-xs text-[var(--fo-muted)]">Salen del producto del ticket.</p>
          </div>
        )}

        <label className="block max-w-40">
          <span className="fo-label">Hojas</span>
          <input
            type="number"
            min={1}
            max={HOJAS_MAX}
            step={1}
            className="fo-input"
            value={copias}
            onChange={(e) => setCopias(Math.min(HOJAS_MAX, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
          />
        </label>

        <button type="button" className="fo-btn fo-btn-primary w-full" disabled={!puedeArmar || armando} onClick={() => void armar()}>
          <LayoutGrid className="size-4" aria-hidden />
          {armando ? "Armando…" : vigente ? "Volver a armar" : "Armar plancha"}
        </button>

        {error ? <p className="fo-alert-error">{error}</p> : null}

        {vigente ? (
          <div className="space-y-3">
            {vigente.aviso !== "OK" ? (
              <p className="fo-alert-warning">
                {TEXTO_AVISO[vigente.aviso]} ({vigente.ppp} ppp efectivos)
              </p>
            ) : null}
            <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
              {vigente.fotosPorHoja} fotos por hoja, con líneas para cortar. Imprimila en tamaño real, sin «ajustar a la página».
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className="fo-btn fo-btn-primary" onClick={() => window.open(`/imprimir/hoja/${vigente.hojaId}?v=${vigente.version}`, "_blank")}>
                <Printer className="size-4" aria-hidden />
                Imprimir
              </button>
              <a className="fo-btn fo-btn-secondary" href={`/api/impresion/hoja/${vigente.hojaId}?descargar=1&v=${vigente.version}`}>
                <Download className="size-4" aria-hidden />
                Descargar JPG
              </a>
            </div>
            <EnviarPorMail preparacionId={preparacionId} emailInicial={emailInicial} />
            {modo.tipo === "mostrador" ? (
              <button
                type="button"
                className="fo-btn fo-btn-primary w-full"
                onClick={() => modo.onListo({ hojas: copias, preparacionId })}
              >
                <Check className="size-4" aria-hidden />
                Listo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
