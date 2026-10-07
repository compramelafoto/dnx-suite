"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { importarConsultasAction, previsualizarImportacionConsultasAction } from "@/app/actions/consultas-import";
import type { ResultadoAnalisisConsultas, ResultadoImportacionConsultas } from "@/lib/consultas/importar";

const MENSAJE_FALLA = "No se pudo completar. Probá de nuevo.";
const ETIQUETA_ESTADO = { VALIDA: "Se carga", ERROR: "Con errores", DUPLICADA: "Ya existe" } as const;
/** Igual que `MAX_BYTES_IMPORTACION_CONSULTAS` (el servidor lo vuelve a mirar). */
const MAX_BYTES = 2 * 1024 * 1024;
const GRANDE = "El archivo pesa más de 2 MB. Partilo en varios.";

/** "2026-12-20" → "20/12/2026" (es una fecha de calendario: sin zona horaria). */
function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * Importación de consultas en dos pasos: subir o pegar el CSV y ver la vista previa con errores
 * por fila; después confirmar. El servidor vuelve a analizar el texto al confirmar. Los valores
 * del archivo se muestran como texto (nunca como HTML ni como fórmula).
 */
export function ImportarConsultas({ encabezado }: { encabezado: string }) {
  const [texto, setTexto] = useState("");
  const [analisis, setAnalisis] = useState<Extract<ResultadoAnalisisConsultas, { ok: true }> | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoImportacionConsultas, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function reiniciar(nuevo: string) {
    setTexto(nuevo);
    setAnalisis(null);
    setResultado(null);
    setError(null);
  }

  function previsualizar() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await previsualizarImportacionConsultasAction(texto);
        if (!r.ok) {
          setError(r.error);
          setAnalisis(null);
          return;
        }
        setAnalisis(r);
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  function confirmar() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await importarConsultasAction(texto);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        setResultado(r);
        setAnalisis(null);
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  if (resultado) {
    return (
      <section className="fo-card space-y-3 p-6" role="status">
        <p className="text-base font-semibold text-[var(--fo-text)]">
          {resultado.creadas === 1 ? "Se cargó 1 consulta." : `Se cargaron ${resultado.creadas} consultas.`}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--fo-muted)]">
          {resultado.duplicadas > 0 ? <li>{resultado.duplicadas} ya existían y no se repitieron.</li> : null}
          {resultado.conError > 0 ? <li>{resultado.conError} tenían errores y no se cargaron.</li> : null}
          {resultado.fallidas.length > 0 ? (
            <li className="text-[var(--fo-danger)]">
              {resultado.fallidas.length} no se pudieron guardar (filas {resultado.fallidas.map((f) => f.fila).join(", ")}). Volvé a
              importar el archivo: las que ya entraron no se repiten.
            </li>
          ) : null}
          {resultado.sinEtapa.length > 0 ? (
            <li>
              {resultado.sinEtapa.length} se cargaron pero quedaron en la primera etapa:
              <ul className="list-disc pl-5">
                {resultado.sinEtapa.slice(0, 20).map((f) => (
                  <li key={f.fila}>
                    Fila {f.fila}: {f.error}
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
        <div className="flex gap-2">
          <Link href="/consultas/lista" className="fo-btn fo-btn-primary text-sm">
            Ver consultas
          </Link>
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => reiniciar("")}>
            Importar otro archivo
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="fo-card space-y-4 p-6">
        <div className="space-y-2 text-sm text-[var(--fo-muted)]">
          <p>
            La primera fila tiene que tener los nombres de las columnas. Hace falta al menos el nombre del contacto; el resto es
            opcional. Columnas que se reconocen:
          </p>
          <pre className="overflow-x-auto rounded-[var(--fo-radius-sm)] bg-[var(--fo-code-bg)] p-3 text-xs text-[var(--fo-text)]">{encabezado}</pre>
          <ul className="list-disc space-y-1 pl-5">
            <li>Categoría, origen y etapa: por su nombre, como están en Configuración → Consultas y en el circuito de ventas. Sin categoría, va a «Otro».</li>
            <li>Fecha del evento: dd/mm/aaaa o aaaa-mm-dd. Valor: sin símbolo, por ejemplo 150000 o 150.000,50.</li>
            <li>Responsable: el correo de alguien del equipo con permiso para gestionar Consultas.</li>
            <li>El contacto se busca por correo o teléfono; si no existe, se crea. No se repiten consultas con el mismo correo, categoría y fecha.</li>
            <li>No se manda ningún aviso al equipo ni respuesta automática.</li>
          </ul>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="importar-consultas-archivo">
            Archivo CSV (hasta 2 MB)
          </label>
          <input
            id="importar-consultas-archivo"
            type="file"
            accept=".csv,text/csv"
            className="fo-input"
            onChange={async (e) => {
              const archivo = e.target.files?.[0];
              if (!archivo) return;
              if (archivo.size > MAX_BYTES) {
                reiniciar("");
                setError(GRANDE);
                return;
              }
              reiniciar(await archivo.text());
            }}
          />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="importar-consultas-texto">
            O pegá el contenido
          </label>
          <textarea
            id="importar-consultas-texto"
            className="fo-input min-h-40 font-mono text-xs"
            value={texto}
            onChange={(e) => reiniciar(e.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {error}
          </p>
        ) : null}
        <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || !texto.trim()} onClick={previsualizar}>
          {pendiente && !analisis ? "Revisando…" : "Revisar"}
        </button>
      </section>

      {analisis ? (
        <section className="fo-card space-y-4 p-6" aria-labelledby="importar-consultas-vista">
          <h2 id="importar-consultas-vista" className="text-base font-semibold text-[var(--fo-text)]">
            Vista previa
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {analisis.validas} se cargan · {analisis.duplicadas} ya existen · {analisis.conError} con errores
          </p>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-[var(--fo-muted)]">
                <tr>
                  <th className="py-1 pr-3 font-medium">Fila</th>
                  <th className="py-1 pr-3 font-medium">Nombre</th>
                  <th className="py-1 pr-3 font-medium">Correo</th>
                  <th className="py-1 pr-3 font-medium">Categoría</th>
                  <th className="py-1 pr-3 font-medium">Fecha</th>
                  <th className="py-1 pr-3 font-medium">Etapa</th>
                  <th className="py-1 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)]">
                {analisis.filas.map((f) => (
                  <tr key={f.fila} className="align-top">
                    <td className="py-1.5 pr-3 tabular-nums text-[var(--fo-muted)]">{f.fila}</td>
                    <td className="py-1.5 pr-3">{f.nombre}</td>
                    <td className="py-1.5 pr-3 break-all">{f.correo ?? "—"}</td>
                    <td className="py-1.5 pr-3">{f.categoria ?? "—"}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{fechaCorta(f.fecha)}</td>
                    <td className="py-1.5 pr-3">{f.etapa ?? "Primera"}</td>
                    <td className="py-1.5">
                      <span className={f.estado === "VALIDA" ? "text-[var(--fo-success)]" : f.estado === "ERROR" ? "text-[var(--fo-danger)]" : "text-[var(--fo-warning)]"}>
                        {ETIQUETA_ESTADO[f.estado]}
                      </span>
                      {f.errores.length > 0 ? (
                        <ul className="mt-0.5 text-xs text-[var(--fo-muted)]">
                          {f.errores.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || analisis.validas === 0} onClick={confirmar}>
            {pendiente ? "Importando…" : analisis.validas === 1 ? "Importar 1 consulta" : `Importar ${analisis.validas} consultas`}
          </button>
        </section>
      ) : null}
    </div>
  );
}
