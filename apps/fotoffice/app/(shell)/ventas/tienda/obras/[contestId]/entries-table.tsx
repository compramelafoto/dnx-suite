"use client";

import { useState, useTransition } from "react";
import type { CatalogRow } from "@/lib/store/artworks/catalog";
import {
  publishArtworkAction,
  requestConsentsAction,
  unpublishArtworkAction,
  type ContestActionResult,
} from "./actions";
import { ContestResult } from "./contest-result";

/** Las obras del concurso: elegir para avisar o pedir permiso, reenviar, publicar y despublicar. */
export function EntriesTable({ contestId, rows }: { contestId: string; rows: CatalogRow[] }) {
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<ContestActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();

  const correr = (accion: () => Promise<ContestActionResult>, alTerminar?: () => void) => {
    setResultado(null);
    startTransition(async () => {
      const r = await accion();
      setResultado(r);
      if (r.ok) alTerminar?.();
    });
  };
  const alternar = (id: string) =>
    setElegidas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const todas = rows.length > 0 && rows.every((r) => elegidas.has(r.entryId));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="fo-btn fo-btn-primary text-sm"
          disabled={pendiente || elegidas.size === 0}
          onClick={() => {
            if (
              !window.confirm(
                `¿Mandar el correo a los autores de ${elegidas.size} ${elegidas.size === 1 ? "obra" : "obras"}? A quienes aceptaron bases que ya permiten vender se les avisa; a los demás se les pide permiso.`,
              )
            ) {
              return;
            }
            correr(() => requestConsentsAction(contestId, [...elegidas]), () => setElegidas(new Set()));
          }}
        >
          {pendiente ? "Procesando…" : `Avisar / pedir permiso${elegidas.size ? ` (${elegidas.size})` : ""}`}
        </button>
        <span className="fo-helper">Hasta 100 obras por vez.</span>
      </div>
      <ContestResult resultado={resultado} />

      <div className="fo-card overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="text-[var(--fo-muted)]">
            <tr className="border-b border-[var(--fo-border)]">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Elegir todas las obras de esta página"
                  checked={todas}
                  onChange={() => setElegidas(todas ? new Set() : new Set(rows.map((r) => r.entryId)))}
                />
              </th>
              <th className="px-3 py-2 font-semibold">Obra</th>
              <th className="px-3 py-2 font-semibold">Autor</th>
              <th className="px-3 py-2 font-semibold">Premio</th>
              <th className="px-3 py-2 font-semibold">Original</th>
              <th className="px-3 py-2 font-semibold">Permiso</th>
              <th className="px-3 py-2 font-semibold">Tienda</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--fo-border)]">
            {rows.map((r) => {
              const publicada = r.listingStatus === "PUBLISHED";
              return (
                <tr key={r.entryId} className="align-middle hover:bg-[var(--fo-surface-hover)]">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Elegir ${r.title}`}
                      checked={elegidas.has(r.entryId)}
                      onChange={() => alternar(r.entryId)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-[var(--fo-surface-hover)]">
                        {r.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- enlace firmado de FotoRank o vista previa de R2
                          <img src={r.thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{r.title}</div>
                        {r.entryNumber ? <div className="text-xs text-[var(--fo-muted)]">{r.entryNumber}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.authorName ?? <span className="text-[var(--fo-muted)]">—</span>}</td>
                  <td className="px-3 py-2">{r.award?.label ?? <span className="text-[var(--fo-muted)]">—</span>}</td>
                  <td className="px-3 py-2 text-[var(--fo-muted)]">
                    {r.original ? `${r.original.width} × ${r.original.height} px` : "—"}
                  </td>
                  <td className="px-3 py-2">{r.consentLabel}</td>
                  <td className="px-3 py-2">{r.listingLabel}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.canResend ? (
                        <button
                          type="button"
                          className="fo-btn fo-btn-ghost text-xs"
                          disabled={pendiente}
                          onClick={() => correr(() => requestConsentsAction(contestId, [r.entryId]))}
                        >
                          Reenviar
                        </button>
                      ) : null}
                      {publicada ? (
                        <button
                          type="button"
                          className="fo-btn fo-btn-secondary text-xs"
                          disabled={pendiente}
                          onClick={() => {
                            if (!window.confirm(`¿Sacar "${r.title}" de la tienda? Los pedidos ya hechos no cambian.`)) return;
                            correr(() => unpublishArtworkAction(contestId, r.entryId));
                          }}
                        >
                          Despublicar
                        </button>
                      ) : r.sellable ? (
                        <button
                          type="button"
                          className="fo-btn fo-btn-primary text-xs"
                          disabled={pendiente}
                          onClick={() => correr(() => publishArtworkAction(contestId, r.entryId))}
                        >
                          Publicar
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
