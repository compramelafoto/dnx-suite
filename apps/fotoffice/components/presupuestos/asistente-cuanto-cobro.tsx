"use client";

import { useState } from "react";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { nuevaClave, pesos } from "@/lib/presupuestos/editor";
import { armarItemsDelAsistente, PERFIL_VACIO, trabajoVacio, type PerfilPanel, type TrabajoPanel } from "@/lib/presupuestos/panel-cuanto-cobro";
import { CampoTexto, CamposPerfil, CamposTrabajo } from "./panel-cuanto-cobro";

/**
 * "Armar con ¿Cuánto Cobro?" (spec §3.2): un perfil y los conceptos del trabajo dan un ítem
 * calculado por concepto. Sólo para quien tiene `configurar` (R4), como el panel.
 */
export function AsistenteCuantoCobro({
  perfilInicial,
  onAgregar,
  onCerrar,
}: {
  perfilInicial: PerfilPanel | null;
  onAgregar: (items: ItemPresupuesto[], perfil: PerfilPanel) => void;
  onCerrar: () => void;
}) {
  const [perfil, setPerfil] = useState<PerfilPanel>(perfilInicial ?? PERFIL_VACIO);
  const [verPerfil, setVerPerfil] = useState(perfilInicial === null);
  const [tipoDeTrabajo, setTipoDeTrabajo] = useState("");
  const [seccion, setSeccion] = useState("");
  const [trabajos, setTrabajos] = useState<TrabajoPanel[]>([trabajoVacio("Cobertura")]);

  const r = armarItemsDelAsistente(perfil, trabajos, tipoDeTrabajo, { seccion: seccion.trim() || null, nuevaClave });
  const total = r.ok ? r.items.reduce((s, i) => s + i.precioUnitario, 0) : 0;

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

      <div className="space-y-2">
        <button type="button" className="text-sm font-medium text-[var(--fo-accent)] hover:underline" onClick={() => setVerPerfil((v) => !v)} aria-expanded={verPerfil}>
          {verPerfil ? "Ocultar tu perfil" : "Tu perfil (gastos y horas)"}
        </button>
        {verPerfil ? <CamposPerfil perfil={perfil} onCambio={setPerfil} /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto etiqueta="Tipo de trabajo" tipo="text" valor={tipoDeTrabajo} onCambio={setTipoDeTrabajo} />
        <CampoTexto etiqueta="Sección (opcional)" tipo="text" valor={seccion} onCambio={setSeccion} />
      </div>

      <ol className="space-y-4">
        {trabajos.map((t, i) => (
          <li key={i} className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--fo-text)]">Concepto {i + 1}</p>
              {trabajos.length > 1 ? (
                <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setTrabajos((ts) => ts.filter((_, j) => j !== i))}>
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

      {r.ok ? (
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
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => onAgregar(r.items, perfil)}>
            Agregar {r.items.length === 1 ? "el ítem" : `los ${r.items.length} ítems`}
          </button>
        </div>
      ) : (
        <div className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] p-3 text-sm" role="status">
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
