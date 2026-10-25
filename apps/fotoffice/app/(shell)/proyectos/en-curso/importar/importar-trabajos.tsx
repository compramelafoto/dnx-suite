"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, Upload } from "lucide-react";
import { importarTrabajosAction } from "@/app/actions/proyectos-importar";
import { FASE_INFO } from "@/lib/proyectos/en-curso-puro";
import { leerImportacion, restaDeFila } from "@/lib/proyectos/importar-trabajos";
import type { ResultadoFila } from "@/lib/proyectos/importar-trabajos-servidor";

const EJEMPLO = "Cliente | Teléfono | Tipo | Detalle | Total | Seña | Estado | Entrega";

function pesos(n: number) {
  return `$ ${new Intl.NumberFormat("es-AR").format(n)}`;
}

/**
 * Pegar las filas, revisar la vista previa e importar. La seña ya cobrada no entra a Caja: el
 * pedido queda por lo que resta. Importar dos veces la misma fila no la duplica.
 */
export function ImportarTrabajos() {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoFila[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importando, start] = useTransition();
  const hoy = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()), []);
  const leido = useMemo(() => leerImportacion(texto, hoy), [texto, hoy]);

  function importar() {
    setError(null);
    start(async () => {
      const r = await importarTrabajosAction(texto);
      if (r.ok) setResultados(r.resultados);
      else setError(r.error);
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Link href="/proyectos/en-curso" className="inline-flex items-center gap-1 text-sm text-[var(--fo-muted)] hover:text-[var(--fo-text)]">
        <ArrowLeft className="size-4" aria-hidden /> Trabajos en curso
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-[var(--fo-text)]">Importar trabajos desde una planilla</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Una fila por trabajo, separada con <code>|</code> o pegada directo de Google Sheets. La seña ya cobrada no entra a Caja: el pedido
          queda por lo que resta. No se le manda ningún correo al cliente.
        </p>
      </div>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setResultados(null);
        }}
        rows={10}
        placeholder={`${EJEMPLO}\nDebora Scot | 3416210024 | VHS | 1 VHS y 9 DVD | 127000 | 63500 | Recibido |`}
        className="fo-input w-full font-mono text-xs"
      />
      <p className="text-xs text-[var(--fo-muted)]">
        Tipo: VHS, DVD, CD, CASETE, ROLLO, FOTOLIBRO o LABORATORIO · Estado: Recibido, En proceso, En el proveedor (o Enviado), Listo para retirar ·
        Entrega: dd/mm (opcional).
      </p>

      {leido.errores.length > 0 ? (
        <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-danger-border)] p-3 text-sm">
          <p className="font-semibold text-[var(--fo-danger)]">Estas filas no se van a importar:</p>
          {leido.errores.map((e) => (
            <p key={e.renglon} className="text-xs text-[var(--fo-danger)]">
              Renglón {e.renglon}: {e.error}
            </p>
          ))}
        </div>
      ) : null}

      {leido.filas.length > 0 ? (
        <div className="fo-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--fo-muted)]">
              <tr>
                <th className="p-2">Cliente</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Detalle</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 text-right">Seña</th>
                <th className="p-2 text-right">Debe</th>
                <th className="p-2">Queda en</th>
                <th className="p-2">Entrega</th>
                {resultados ? <th className="p-2">Resultado</th> : null}
              </tr>
            </thead>
            <tbody>
              {leido.filas.map((f) => {
                const res = resultados?.find((r) => r.renglon === f.renglon);
                return (
                  <tr key={f.renglon} className="border-t border-[var(--fo-border)]">
                    <td className="p-2">
                      {f.cliente}
                      {f.telefono ? <span className="block text-xs text-[var(--fo-muted)]">{f.telefono}</span> : null}
                    </td>
                    <td className="p-2">{f.tipo}</td>
                    <td className="p-2 text-xs">{f.detalle}</td>
                    <td className="p-2 text-right tabular-nums">{pesos(f.total)}</td>
                    <td className="p-2 text-right tabular-nums">{pesos(f.sena)}</td>
                    <td className="p-2 text-right font-semibold tabular-nums">{pesos(restaDeFila(f))}</td>
                    <td className="p-2 text-xs">{FASE_INFO[f.fase].titulo}</td>
                    <td className="p-2 text-xs tabular-nums">{f.entrega ?? "—"}</td>
                    {resultados ? (
                      <td
                        className={`p-2 text-xs ${
                          res?.estado === "IMPORTADO" ? "text-[var(--fo-success)]" : res?.estado === "ERROR" ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"
                        }`}
                      >
                        {res?.detalle ?? ""}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="button" onClick={importar} disabled={importando || leido.filas.length === 0} className="fo-btn fo-btn-primary inline-flex items-center gap-1.5">
          <Upload className="size-4" aria-hidden />
          {importando ? "Importando…" : `Importar ${leido.filas.length} ${leido.filas.length === 1 ? "trabajo" : "trabajos"}`}
        </button>
        {resultados ? (
          <Link href="/proyectos/en-curso" className="text-sm text-[var(--fo-accent)] hover:underline">
            Ver el tablero
          </Link>
        ) : null}
      </div>
    </div>
  );
}
