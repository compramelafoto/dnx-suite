"use client";

import { useRef, useState } from "react";

type Formato = "lightroom" | "windows";

const FORMATOS: { clave: Formato; etiqueta: string }[] = [
  { clave: "lightroom", etiqueta: "Lightroom" },
  { clave: "windows", etiqueta: "Windows / Finder" },
];

function Bloque({ n, total, texto }: { n: number; total: number; texto: string }) {
  const [estado, setEstado] = useState<"idle" | "copiado" | "manual">("idle");
  const area = useRef<HTMLTextAreaElement>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
      window.setTimeout(() => setEstado("idle"), 2500);
    } catch {
      // Sin permiso para el portapapeles: se deja el texto seleccionado para copiar a mano.
      setEstado("manual");
      area.current?.focus();
      area.current?.select();
    }
  }

  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-[var(--fo-muted)]" htmlFor={`bloque-${n}`}>
          Bloque {n} de {total} · {texto.length.toLocaleString("es-AR")} caracteres
        </label>
        <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={copiar}>
          {estado === "copiado" ? "Copiado" : "Copiar"}
        </button>
      </div>
      <textarea
        id={`bloque-${n}`}
        ref={area}
        readOnly
        rows={3}
        className="fo-input w-full font-mono text-xs"
        value={texto}
        onFocus={(e) => e.currentTarget.select()}
      />
      {estado === "manual" ? <p className="text-xs text-[var(--fo-muted)]">No pudimos copiarlo solos: el texto quedó seleccionado, copialo con Ctrl+C (o Cmd+C).</p> : null}
    </li>
  );
}

/**
 * Exportar la selección de un cliente: nombres sin extensión en bloques de hasta 1.000 caracteres (el límite del
 * buscador de Lightroom) para pegar, y un CSV con los comentarios. Los bloques los arma el servidor.
 */
export function ExportarSeleccion({
  galeriaId, clienteId, total, lightroom, windows,
}: {
  galeriaId: string;
  clienteId: string;
  total: number;
  lightroom: string[];
  windows: string[];
}) {
  const [formato, setFormato] = useState<Formato>("lightroom");
  const bloques = formato === "lightroom" ? lightroom : windows;
  const csv = `/api/galerias/${encodeURIComponent(galeriaId)}/clientes/${encodeURIComponent(clienteId)}/exportar`;

  return (
    <section aria-labelledby="exportar-titulo" className="fo-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="exportar-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Exportar la selección
        </h2>
        <a href={csv} className={`fo-btn fo-btn-secondary text-xs ${total === 0 ? "pointer-events-none opacity-50" : ""}`} aria-disabled={total === 0} download>
          Descargar CSV
        </a>
      </div>
      {total === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Este cliente todavía no eligió fotos.</p>
      ) : (
        <>
          <div role="tablist" aria-label="Programa de destino" className="flex gap-1 border-b border-[var(--fo-border)]">
            {FORMATOS.map((f) => (
              <button
                key={f.clave}
                type="button"
                role="tab"
                aria-selected={formato === f.clave}
                onClick={() => setFormato(f.clave)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
                  formato === f.clave ? "border-[var(--fo-accent,#1d4ed8)] text-[var(--fo-text)]" : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
          {formato === "lightroom" ? (
            <p className="text-sm text-[var(--fo-muted)]">
              En Lightroom: Biblioteca → Filtro de biblioteca → Texto → Nombre de archivo → <strong>Contiene</strong> (no &quot;Contiene todos&quot;) y pegá cada bloque, uno por vez. Son{" "}
              {total.toLocaleString("es-AR")} {total === 1 ? "foto" : "fotos"} en {bloques.length} {bloques.length === 1 ? "bloque" : "bloques"}.
            </p>
          ) : (
            <p className="text-sm text-[var(--fo-muted)]">
              En el buscador del Explorador de Windows o del Finder pegá cada bloque, uno por vez (van separados con OR). Son {total.toLocaleString("es-AR")}{" "}
              {total === 1 ? "foto" : "fotos"} en {bloques.length} {bloques.length === 1 ? "bloque" : "bloques"}.
            </p>
          )}
          <ol className="space-y-3">
            {bloques.map((b, i) => (
              <Bloque key={`${formato}-${i}`} n={i + 1} total={bloques.length} texto={b} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
