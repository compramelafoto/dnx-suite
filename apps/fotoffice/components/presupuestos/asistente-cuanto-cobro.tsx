"use client";

import { useState } from "react";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { nuevaClave, pesos } from "@/lib/presupuestos/editor";
import { armarItemsDelAsistente, trabajoVacio, type TrabajoPanel } from "@/lib/presupuestos/panel-cuanto-cobro";
import { AvisoSinPerfil, CampoTexto, CamposTrabajo, PerfilEnUso } from "./panel-cuanto-cobro";

/**
 * "Armar con ¿Cuánto Cobro?" (spec §3.2): el perfil de Configuración → Precios y los conceptos del trabajo dan un ítem
 * calculado por concepto. Sólo para quien tiene `configurar` (R4), como el panel.
 */
export function AsistenteCuantoCobro({
  perfilDelWorkspace,
  onAgregar,
  onCerrar,
}: {
  /** El perfil de Configuración → Precios, o null si todavía no lo cargaron. */
  perfilDelWorkspace: CuantoCobroProfileInput | null;
  onAgregar: (items: ItemPresupuesto[]) => void;
  onCerrar: () => void;
}) {
  const perfil = perfilDelWorkspace;
  const [tipoDeTrabajo, setTipoDeTrabajo] = useState("");
  const [seccion, setSeccion] = useState("");
  const [trabajos, setTrabajos] = useState<TrabajoPanel[]>([trabajoVacio("Cobertura")]);

  // La vista previa usa claves fijas (por posición): las claves de verdad se generan recién al
  // agregar, así no cambian en cada tecla.
  const opciones = (clave: () => string) => ({ seccion: seccion.trim() || null, nuevaClave: clave });
  let n = 0;
  const r = perfil ? armarItemsDelAsistente(perfil, trabajos, tipoDeTrabajo, opciones(() => `vista-${n++}`)) : null;
  const total = r?.ok ? r.items.reduce((s, i) => s + i.precioUnitario, 0) : 0;

  return (
    <section aria-label="Armar con ¿Cuánto Cobro?" className="space-y-4 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fo-text)]">Armar con ¿Cuánto Cobro?</h3>
          <p className="text-xs text-[var(--fo-muted)]">Cada concepto se convierte en un ítem calculado. Sólo lo ven el dueño y los administradores.</p>
        </div>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={onCerrar}>
          Cerrar
        </button>
      </div>

      {perfil ? <PerfilEnUso perfil={perfil} /> : <AvisoSinPerfil />}

      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto etiqueta="Tipo de trabajo" tipo="text" valor={tipoDeTrabajo} onCambio={setTipoDeTrabajo} />
        <CampoTexto etiqueta="Sección (opcional)" tipo="text" valor={seccion} onCambio={setSeccion} />
      </div>

      <ol className="space-y-4">
        {trabajos.map((t, i) => (
          <li key={i} aria-label={`Concepto ${i + 1}${t.nombre.trim() ? `: ${t.nombre.trim()}` : ""}`} className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--fo-text)]">Concepto {i + 1}</p>
              {trabajos.length > 1 ? (
                <button
                  type="button"
                  className="fo-btn fo-btn-ghost text-xs"
                  aria-label={`Quitar el concepto ${i + 1}${t.nombre.trim() ? ` (${t.nombre.trim()})` : ""}`}
                  onClick={() => setTrabajos((ts) => ts.filter((_, j) => j !== i))}
                >
                  Quitar
                </button>
              ) : null}
            </div>
            <CamposTrabajo trabajo={t} onCambio={(nuevo) => setTrabajos((ts) => ts.map((x, j) => (j === i ? nuevo : x)))} />
            {i > 0 ? <p className="text-xs text-[var(--fo-muted)]">Las horas con el cliente se cuentan sólo en el primer concepto.</p> : null}
          </li>
        ))}
      </ol>
      <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setTrabajos((ts) => [...ts, trabajoVacio("")])}>
        Agregar concepto
      </button>

      {/* Región viva siempre presente: anuncia sólo el resultado final, no cada dato que falta. */}
      <p className="sr-only" aria-live="polite">
        {r?.ok ? `Total sugerido: ${pesos(total)}` : ""}
      </p>
      {!r ? null : r.ok ? (
        <div className="space-y-2 rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] p-3 text-sm">
          <ul className="space-y-1">
            {r.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-2">
                <span>{it.nombre}</span>
                <span className="tabular-nums">{pesos(it.precioUnitario)}</span>
              </li>
            ))}
          </ul>
          <p className="font-semibold text-[var(--fo-text)]">Total sugerido: {pesos(total)}</p>
          <button
            type="button"
            className="fo-btn fo-btn-primary text-sm"
            onClick={() => {
              if (!perfil) return;
              const final = armarItemsDelAsistente(perfil, trabajos, tipoDeTrabajo, opciones(nuevaClave));
              if (final.ok) onAgregar(final.items);
            }}
          >
            Agregar {r.items.length === 1 ? "el ítem" : `los ${r.items.length} ítems`}
          </button>
        </div>
      ) : (
        <div className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] p-3 text-sm">
          <p>{r.error}</p>
          {r.faltan.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--fo-muted)]">
              {r.faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
