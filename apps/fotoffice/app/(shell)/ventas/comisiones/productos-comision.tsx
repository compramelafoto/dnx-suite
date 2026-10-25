"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMinorArs } from "@/lib/membership/money";
import { guardarProductosComisionAction } from "./actions";

type Producto = { id: string; nombre: string; categoria: string; precioMinor: number; margenPct: number | null };

/**
 * Qué productos dan comisión, agrupados por categoría y con su margen: así se ve qué aguanta
 * pagar el porcentaje. Una casilla por categoría marca o desmarca todos sus productos.
 */
export function ProductosComision({ productos, elegidos }: { productos: Producto[]; elegidos: string[] }) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set(elegidos));
  const [abierta, setAbierta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();
  const categorias = useMemo(() => {
    const m = new Map<string, Producto[]>();
    for (const p of productos) m.set(p.categoria, [...(m.get(p.categoria) ?? []), p]);
    return [...m.entries()];
  }, [productos]);

  function alternar(ids: string[], marcar: boolean) {
    setMarcados((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (marcar) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  }

  function guardar() {
    setAviso(null);
    startTransition(async () => {
      const r = await guardarProductosComisionAction([...marcados]);
      setAviso(r.ok ? "Guardado." : r.error);
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="fo-card space-y-3 p-4">
      <div>
        <h2 className="font-semibold">Qué productos dan comisión</h2>
        <p className="fo-helper">El margen es lo que queda del precio después del costo: la comisión sale de ahí.</p>
      </div>
      <ul className="divide-y divide-[var(--fo-border)]">
        {categorias.map(([cat, ps]) => {
          const n = ps.filter((p) => marcados.has(p.id)).length;
          return (
            <li key={cat} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={n === ps.length}
                    ref={(el) => {
                      if (el) el.indeterminate = n > 0 && n < ps.length;
                    }}
                    onChange={(e) => alternar(ps.map((p) => p.id), e.target.checked)}
                  />
                  {cat}
                  <span className="text-xs font-normal text-[var(--fo-muted)]">
                    {n} de {ps.length}
                  </span>
                </label>
                <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setAbierta((a) => (a === cat ? null : cat))}>
                  {abierta === cat ? "Ocultar" : "Ver productos"}
                </button>
              </div>
              {abierta === cat ? (
                <ul className="mt-2 space-y-1 pl-6">
                  {ps.map((p) => (
                    <li key={p.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={marcados.has(p.id)} onChange={(e) => alternar([p.id], e.target.checked)} />
                        <span className="flex-1">{p.nombre}</span>
                        <span className="tabular-nums text-xs text-[var(--fo-muted)]">
                          {formatMinorArs(p.precioMinor).replace(/,00$/, "")}
                          {p.margenPct !== null ? ` · margen ${p.margenPct} %` : " · sin costo"}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : `Guardar (${marcados.size} productos)`}
        </button>
        {aviso ? <span className="text-sm">{aviso}</span> : null}
      </div>
    </section>
  );
}
