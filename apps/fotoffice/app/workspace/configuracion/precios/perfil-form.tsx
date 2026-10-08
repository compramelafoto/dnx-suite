"use client";

import { useMemo, useState, useTransition } from "react";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { validarPerfil } from "@/lib/precios/perfil-datos";
import { resumirPerfil } from "@/lib/precios/resumen";
import { pesos } from "@/lib/presupuestos/editor";
import { guardarPerfilPreciosAction } from "./actions";
import {
  SeccionEquipo,
  SeccionGastosPersonales,
  SeccionIngresos,
  SeccionNegocio,
  SeccionPosicionamiento,
  SeccionReservas,
  SeccionTiempo,
} from "./secciones";

/**
 * Formulario del perfil de precios. El estado es el perfil completo (`CuantoCobroProfileInput`);
 * el resumen se recalcula en vivo con el mismo cálculo que usan los presupuestos.
 */
export function PerfilForm({ inicial }: { inicial: CuantoCobroProfileInput }) {
  const [perfil, setPerfil] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();
  const resumen = useMemo(() => resumirPerfil(perfil), [perfil]);

  const cambiar = (parcial: Partial<CuantoCobroProfileInput>) => {
    setPerfil((p) => ({ ...p, ...parcial }));
    setOk(null);
  };

  function guardar() {
    setError(null);
    setOk(null);
    const v = validarPerfil(perfil);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    empezar(async () => {
      const r = await guardarPerfilPreciosAction(perfil);
      if (r.ok) setOk("Perfil guardado.");
      else setError(r.error);
    });
  }

  const props = { perfil, cambiar };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <aside className="sticky top-0 z-10 lg:order-2 lg:self-start" aria-label="Resumen en vivo">
        <div className="fo-card space-y-3 p-4 text-sm">
          <h2 className="text-base font-semibold">Tu resumen</h2>
          <dl className="space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--fo-muted)]">Necesidad mensual</dt>
              <dd className="font-medium">{pesos(resumen.necesidadMensual)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--fo-muted)]">Horas que se cobran por mes</dt>
              <dd className="font-medium">{Math.round(resumen.horasFacturablesMes * 10) / 10}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--fo-muted)]">Valor de tu hora</dt>
              <dd className="font-medium">{resumen.valorHora === null ? "—" : pesos(resumen.valorHora)}</dd>
            </div>
          </dl>
          {!resumen.completo ? (
            <div>
              <p className="font-medium">Te falta completar</p>
              <ul className="list-disc pl-5 text-[var(--fo-muted)]">
                {resumen.faltan.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
      <form
        className="space-y-6 lg:order-1"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <SeccionIngresos {...props} />
        <SeccionGastosPersonales {...props} />
        <SeccionNegocio {...props} />
        <SeccionTiempo {...props} />
        <SeccionEquipo {...props} />
        <SeccionReservas {...props} />
        <SeccionPosicionamiento {...props} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="fo-btn fo-btn-primary" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          {ok ? (
            <p role="status" className="text-sm text-[var(--fo-success)]">
              {ok}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
