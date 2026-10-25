"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { importarClientesAction, previsualizarImportacionClientesAction } from "@/app/actions/clientes-import";
import { ETIQUETA_CATEGORIA_CONTACTO } from "@/lib/consultas/constantes";
import type { ResultadoAnalisis, ResultadoImportacion } from "@/lib/clients/importar";

const MENSAJE_FALLA = "No se pudo completar. Probá de nuevo.";
const ETIQUETA_ESTADO = { VALIDA: "Se carga", ERROR: "Con errores", DUPLICADA: "Ya existe" } as const;
/** Igual que `MAX_BYTES_IMPORTACION_CLIENTES` (el servidor lo vuelve a mirar). */
const MAX_BYTES = 2 * 1024 * 1024;
const GRANDE = "El archivo pesa más de 2 MB. Partilo en varios archivos más chicos.";

function textoSinClave(n: number): string {
  return n === 1
    ? "1 fila no tiene documento, correo ni teléfono: no podemos saber si ese cliente ya existe, y si volvés a importar el archivo se carga de nuevo."
    : `${n} filas no tienen documento, correo ni teléfono: no podemos saber si esos clientes ya existen, y si volvés a importar el archivo se cargan de nuevo.`;
}

/**
 * Importación de clientes en dos pasos: pegar o subir el CSV y ver la vista previa con errores
 * por fila; después confirmar. El servidor vuelve a analizar el texto al confirmar.
 */
export function ImportarClientes({ encabezado }: { encabezado: string }) {
  const [texto, setTexto] = useState("");
  const [analisis, setAnalisis] = useState<Extract<ResultadoAnalisis, { ok: true }> | null>(null);
  const [resultado, setResultado] = useState<Extract<ResultadoImportacion, { ok: true }> | null>(null);
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
        const r = await previsualizarImportacionClientesAction(texto);
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
        const r = await importarClientesAction(texto);
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
          {resultado.creados === 1 ? "Se cargó 1 cliente." : `Se cargaron ${resultado.creados} clientes.`}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--fo-muted)]">
          {resultado.duplicadas > 0 ? <li>{resultado.duplicadas} ya existían y no se tocaron.</li> : null}
          {resultado.conError > 0 ? <li>{resultado.conError} tenían errores y no se cargaron.</li> : null}
          {resultado.fallidas > 0 ? (
            <li className="text-[var(--fo-danger)]">
              {resultado.fallidas === 1 ? "1 fila no se pudo guardar" : `${resultado.fallidas} filas no se pudieron guardar`} (
              {resultado.filasFallidas.length > 50
                ? `filas ${resultado.filasFallidas.slice(0, 50).join(", ")} y otras`
                : `${resultado.filasFallidas.length === 1 ? "fila" : "filas"} ${resultado.filasFallidas.join(", ")}`}
              ). Armá un CSV sólo con esas filas y volvé a importarlo.
            </li>
          ) : null}
          {resultado.sinClave > 0 ? <li>{textoSinClave(resultado.sinClave)}</li> : null}
        </ul>
        <div className="flex gap-2">
          <Link href="/clientes" className="fo-btn fo-btn-primary text-sm">
            Ver clientes
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
            La primera fila tiene que tener los nombres de las columnas. Hace falta al menos nombre, apellido o razón social; el
            resto es opcional. Columnas que se reconocen:
          </p>
          <pre className="overflow-x-auto rounded-[var(--fo-radius-sm)] bg-[var(--fo-code-bg)] p-3 text-xs text-[var(--fo-text)]">{encabezado}</pre>
          <p>
            Categoría: Contacto, Cliente, Proveedor o Colaborador (vacía = Cliente). Cumpleaños: dd/mm/aaaa o aaaa-mm-dd. Si un
            cliente ya existe (mismo documento, correo o teléfono), no se carga de nuevo.
          </p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="importar-clientes-archivo">
            Archivo CSV (hasta 2 MB)
          </label>
          <input
            id="importar-clientes-archivo"
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
          <label className="fo-label" htmlFor="importar-clientes-texto">
            O pegá el contenido
          </label>
          <textarea
            id="importar-clientes-texto"
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
        <section className="fo-card space-y-4 p-6" aria-labelledby="importar-clientes-vista">
          <h2 id="importar-clientes-vista" className="text-base font-semibold text-[var(--fo-text)]">
            Vista previa
          </h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {analisis.validas} se cargan · {analisis.duplicadas} ya existen · {analisis.conError} con errores
          </p>
          {analisis.sinClave > 0 ? (
            <p role="note" className="text-sm text-[var(--fo-warning)]">
              {textoSinClave(analisis.sinClave)}
            </p>
          ) : null}
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-[var(--fo-muted)]">
                <tr>
                  <th className="py-1 pr-3 font-medium">Fila</th>
                  <th className="py-1 pr-3 font-medium">Nombre</th>
                  <th className="py-1 pr-3 font-medium">Correo</th>
                  <th className="py-1 pr-3 font-medium">Categoría</th>
                  <th className="py-1 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fo-border)]">
                {analisis.filas.map((f) => (
                  <tr key={f.fila} className="align-top">
                    <td className="py-1.5 pr-3 tabular-nums text-[var(--fo-muted)]">{f.fila}</td>
                    <td className="py-1.5 pr-3">{f.nombre}</td>
                    <td className="py-1.5 pr-3 break-all">{f.correo ?? "—"}</td>
                    <td className="py-1.5 pr-3">{f.categoria ? ETIQUETA_CATEGORIA_CONTACTO[f.categoria] : "Cliente"}</td>
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
            {pendiente ? "Importando…" : analisis.validas === 1 ? "Importar 1 cliente" : `Importar ${analisis.validas} clientes`}
          </button>
        </section>
      ) : null}
    </div>
  );
}
