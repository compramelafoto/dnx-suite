"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { promptParaChatGpt } from "@/lib/precios-proveedor/prompt";
import { analizarCsvLista } from "@/lib/precios-proveedor/csv";
import { crearListaAction } from "../actions";

/**
 * Los tres pasos: elegir proveedor, copiar el prompt para ChatGPT (con el PDF adjunto allá) y
 * subir o pegar el CSV que devuelve. El CSV se revisa acá mismo antes de mandarlo.
 */
export function NuevaLista({ proveedores }: { proveedores: { id: string; name: string }[] }) {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState("");
  const [csv, setCsv] = useState("");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const proveedor = proveedores.find((p) => p.id === proveedorId);
  const prompt = proveedor ? promptParaChatGpt(proveedor.name) : "";
  const analisis = csv.trim() ? analizarCsvLista(csv) : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError("No se pudo copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  async function leerArchivo(f: File | undefined) {
    if (!f) return;
    setArchivo(f.name);
    setCsv(await f.text());
  }

  function subir() {
    setError(null);
    startTransition(async () => {
      const r = await crearListaAction(proveedorId, csv, archivo);
      if (r.ok) router.push(`/ventas/costos/listas/${r.id}`);
      else setError(r.error);
    });
  }

  return (
    <section className="fo-card space-y-5 p-5">
      <h2 className="text-base font-semibold">Cargar una lista nueva</h2>

      <div className="fo-field-stack max-w-sm">
        <label className="fo-label" htmlFor="proveedor">
          1. Proveedor
        </label>
        <select id="proveedor" className="fo-input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Elegí el proveedor…</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {proveedor ? (
        <>
          <div className="space-y-2">
            <p className="fo-label">2. En ChatGPT, adjuntá el PDF de {proveedor.name} y pegá este texto</p>
            <textarea className="fo-input h-40 w-full font-mono text-xs" readOnly value={prompt} aria-label="Prompt para ChatGPT" />
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={copiar}>
              {copiado ? "¡Copiado!" : "Copiar el texto"}
            </button>
          </div>

          <div className="space-y-2">
            <p className="fo-label">3. Subí el CSV que te devuelve (o pegalo abajo)</p>
            <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => leerArchivo(e.target.files?.[0])} aria-label="Archivo CSV" />
            <textarea
              className="fo-input h-32 w-full font-mono text-xs"
              placeholder="proveedor,vigencia,tipo,categoria,producto,…"
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setArchivo(null);
              }}
              aria-label="CSV pegado"
            />
          </div>

          {analisis ? (
            <div className="space-y-1 text-sm">
              {analisis.errorGeneral ? (
                <p className="text-[var(--fo-danger)]">{analisis.errorGeneral}</p>
              ) : (
                <>
                  <p>
                    <strong>{analisis.renglones.length}</strong> renglones válidos
                    {analisis.vigencia ? ` · vigencia ${analisis.vigencia}` : ""}
                    {analisis.duplicadas ? ` · ${analisis.duplicadas} repetidos (quedó el último)` : ""}
                    {analisis.proveedor && analisis.proveedor.toLowerCase() !== proveedor.name.toLowerCase()
                      ? ` · ojo: el CSV dice «${analisis.proveedor}»`
                      : ""}
                  </p>
                  {analisis.errores.length > 0 ? (
                    <details className="text-[var(--fo-danger)]">
                      <summary>{analisis.errores.length} renglones con error (no se cargan)</summary>
                      <ul className="mt-1 max-h-40 overflow-y-auto">
                        {analisis.errores.map((e) => (
                          <li key={e.fila}>
                            Fila {e.fila}: {e.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <button
            type="button"
            className="fo-btn fo-btn-primary text-sm"
            disabled={pendiente || !analisis || !!analisis.errorGeneral || analisis.renglones.length === 0}
            onClick={subir}
          >
            {pendiente ? "Cargando…" : "Cargar y emparejar"}
          </button>
        </>
      ) : null}

      {error ? <p className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
    </section>
  );
}
