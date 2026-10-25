"use client";

import { vidrieraDe } from "@/lib/fotolibro/vidriera";

type Proveedor = { id: string; name: string };

function resumen(nombre: string): string {
  const v = vidrieraDe(nombre);
  const partes = [
    v.rigidas ? `${v.rigidas} ${v.rigidas === 1 ? "medida rígida" : "medidas rígidas"}` : null,
    v.flexibles ? `${v.flexibles} flexibles` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Todas las medidas";
}

/**
 * La vidriera de laboratorios: una tarjeta por cada uno, con su logo, lo que ofrece y las tapas
 * que ya se pueden diseñar. Elegir uno filtra las medidas del libro.
 */
export function VidrieraLaboratorios({ proveedores, elegido, onElegir }: { proveedores: Proveedor[]; elegido: string; onElegir: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Laboratorio">
      {proveedores.map((p) => {
        const v = vidrieraDe(p.name);
        const activo = elegido === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onElegir(activo ? "" : p.id)}
            className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
              activo
                ? "border-[var(--fo-accent)] shadow-lg ring-2 ring-[var(--fo-accent)]"
                : "border-[var(--fo-border)] hover:-translate-y-0.5 hover:shadow-md"
            }`}
          >
            <div className="grid h-24 place-items-center px-4" style={{ background: v.fondo }}>
              {v.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.logo} alt={p.name} className="max-h-16 max-w-full object-contain transition-transform group-hover:scale-105" />
              ) : (
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-lg font-semibold text-slate-600 shadow-inner">{v.iniciales}</span>
              )}
            </div>
            <div className="space-y-1 bg-[var(--fo-surface,white)] px-3 py-2.5">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-[var(--fo-muted)]">{resumen(p.name)}</p>
              {v.tapas.length ? (
                <p className="flex flex-wrap gap-1 pt-0.5">
                  {v.tapas.map((t) => (
                    <span key={t} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                      Tapa {t}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
            {activo ? (
              <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--fo-accent)] text-xs text-white shadow">✓</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
