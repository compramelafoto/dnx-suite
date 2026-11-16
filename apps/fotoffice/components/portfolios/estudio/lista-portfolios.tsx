"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Search } from "lucide-react";
import type { TarjetaPortfolio, VistaRubro } from "./tipos";

const sinAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const ancla = (id: string) => `rubro-${id}`;

/** Busca por título y lugar, salta a un rubro y copia enlaces. Pocos trabajos: todo en el navegador. */
export function ListaPortfolios({ rubros, sinEtiquetar }: { rubros: VistaRubro[]; sinEtiquetar: TarjetaPortfolio[] }) {
  const [busqueda, setBusqueda] = useState("");
  const q = sinAcentos(busqueda.trim());
  const coincide = (t: TarjetaPortfolio) => !q || sinAcentos(`${t.titulo} ${t.detalle}`).includes(q);

  const visibles = useMemo(
    () =>
      rubros.map((r) => ({
        ...r,
        estilos: r.estilos.map((e) => ({ ...e, trabajos: e.trabajos.filter(coincide) })).filter((e) => e.trabajos.length > 0),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rubros, q],
  );
  const sueltos = sinEtiquetar.filter(coincide);

  if (rubros.length === 0 && sinEtiquetar.length === 0) {
    return (
      <section className="fo-card">
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay rubros ni trabajos publicados.</p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fo-muted)]" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o lugar…"
            className="fo-input"
            // fo-input fija su propio padding; inline para dejar lugar a la lupa.
            style={{ paddingLeft: "2.25rem" }}
          />
        </label>
        {rubros.length > 1 ? (
          <label className="block">
            <span className="sr-only">Ir a un rubro</span>
            <select
              className="fo-input"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) document.getElementById(ancla(e.target.value))?.scrollIntoView({ behavior: "smooth", block: "start" });
                e.target.value = "";
              }}
            >
              <option value="">Ir a un rubro…</option>
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.total})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {visibles.map((r) => (
        <section key={r.id} id={ancla(r.id)} className="fo-card scroll-mt-20 space-y-4" aria-labelledby={`${ancla(r.id)}-t`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={`${ancla(r.id)}-t`} className="text-lg font-semibold">
              {r.nombre}
            </h2>
            <span className="text-xs text-[var(--fo-muted)]">{r.total === 1 ? "1 portfolio" : `${r.total} portfolios`}</span>
          </div>

          {r.enlaces.length > 0 && !q ? (
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">Presentaciones de venta</h3>
              <ul className="divide-y divide-[var(--fo-border)]">
                {r.enlaces.map((e, i) => (
                  <li key={`${i}-${e.url}`}className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-sm font-medium">{e.titulo}</span>
                    <Botones url={e.url} titulo={e.titulo} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {r.estilos.map((e) => (
            <div key={e.estilo} className="space-y-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">{e.estilo}</h3>
              <ul className="divide-y divide-[var(--fo-border)]">
                {e.trabajos.map((t) => (
                  <Fila key={t.id} t={t} />
                ))}
              </ul>
            </div>
          ))}

          {r.total === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Todavía no hay trabajos etiquetados en este rubro.</p>
          ) : q && r.estilos.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Nada coincide con la búsqueda en este rubro.</p>
          ) : null}

          {!q ? (
            <p className="rounded-[var(--fo-radius)] border border-dashed border-[var(--fo-border)] px-3 py-2 text-xs text-[var(--fo-muted)]">
              Videos — próximamente
            </p>
          ) : null}
        </section>
      ))}

      {sueltos.length > 0 ? (
        <section className="fo-card space-y-2" aria-labelledby="sin-etiquetar">
          <h2 id="sin-etiquetar" className="text-lg font-semibold">
            Sin etiquetar ({sueltos.length})
          </h2>
          <p className="text-xs text-[var(--fo-muted)]">
            Estos trabajos no tienen rubro: elegíselo en su ficha para que la vendedora los encuentre. Sólo lo ven quienes editan el sitio.
          </p>
          <ul className="divide-y divide-[var(--fo-border)]">
            {sueltos.map((t) => (
              <Fila key={t.id} t={t} fichaHref={`/website/trabajos/${encodeURIComponent(t.id)}`} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Fila({ t, fichaHref }: { t: TarjetaPortfolio; fichaHref?: string }) {
  return (
    <li className={`flex flex-wrap items-center gap-3 py-2 ${t.url ? "" : "opacity-60"}`}>
      {t.portadaUrl ? (
        // Miniatura del bucket público: no pasa por el optimizador de imágenes.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.portadaUrl} alt="" width={64} height={64} loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-[var(--fo-bg-elevated)] text-xs text-[var(--fo-muted)]">sin foto</span>
      )}
      {/* Ancho mínimo: en el celular los botones bajan a otra línea en vez de aplastar el título. */}
      <div className="min-w-[12rem] flex-1">
        <p className="line-clamp-2 text-sm font-medium">{t.titulo}</p>
        {t.detalle ? <p className="text-xs text-[var(--fo-muted)]">{t.detalle}</p> : null}
        {t.motivo ? <p className="text-xs text-[var(--fo-warning)]">No se puede compartir: {t.motivo.toLowerCase()}.</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {fichaHref ? (
          <a href={fichaHref} className="fo-btn fo-btn-secondary text-xs">
            Etiquetar
          </a>
        ) : null}
        {t.url ? <Botones url={t.url} titulo={t.titulo} /> : null}
      </div>
    </li>
  );
}

/** «Abrir» y «Copiar enlace». Si el portapapeles no está disponible, deja el enlace a mano. */
function Botones({ url, titulo }: { url: string; titulo: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "manual">("listo");

  async function copiar() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("sin portapapeles");
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
      setTimeout(() => setEstado("listo"), 2000);
    } catch {
      setEstado("manual");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={url} target="_blank" rel="noreferrer" className="fo-btn fo-btn-secondary text-xs" aria-label={`Abrir ${titulo}`}>
        <ExternalLink className="h-3.5 w-3.5" /> Abrir
      </a>
      <button type="button" onClick={copiar} className="fo-btn fo-btn-primary text-xs" aria-label={`Copiar el enlace de ${titulo}`}>
        {estado === "copiado" ? (
          <>
            <Check className="h-3.5 w-3.5" /> Copiado
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copiar enlace
          </>
        )}
      </button>
      {estado === "manual" ? (
        <span className="flex w-full flex-col gap-1">
          <input readOnly value={url} autoFocus onFocus={(e) => e.currentTarget.select()} className="fo-input text-xs" aria-label="Enlace para copiar" />
          <span className="text-xs text-[var(--fo-muted)]">Copialo a mano.</span>
        </span>
      ) : null}
    </div>
  );
}
