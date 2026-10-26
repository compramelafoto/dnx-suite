"use client";

import { useActionState } from "react";
import { ORIGEN_ALBOOM } from "@/lib/website/redirecciones-reglas";
import { borrarRedireccionAction, crearRedireccionAction, type RedireccionState } from "@/app/actions/website-redirecciones";

const inicial: RedireccionState = { error: null };

export type RedireccionDeLista = { id: string; desde: string; hacia: string; codigo: number; origen: string | null };

/**
 * Sitio web → Redirecciones: las direcciones viejas que llevan a las nuevas (por ejemplo las de la
 * web anterior). Lista, alta y baja; nada más.
 */
export function PanelRedirecciones({
  canEdit,
  redirecciones,
  faltaTabla,
}: {
  canEdit: boolean;
  redirecciones: RedireccionDeLista[];
  faltaTabla: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="fo-card space-y-2">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Redirecciones</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Cuando alguien entra por una dirección vieja (de tu web anterior, o de una página que cambiaste de nombre), lo llevamos
          a la nueva. Así no se pierden los enlaces que ya circulan ni lo que encontró Google.
        </p>
      </div>

      {faltaTabla ? (
        <p className="fo-card text-sm text-[var(--fo-danger)]" role="alert">
          Falta crear la tabla de redirecciones en la base. Avisale al administrador.
        </p>
      ) : (
        <>
          {canEdit ? <FormularioAlta /> : <p className="fo-helper">Sólo quien puede editar el sitio cambia las redirecciones.</p>}
          <Lista canEdit={canEdit} redirecciones={redirecciones} />
        </>
      )}
    </div>
  );
}

function FormularioAlta() {
  const [state, action, pending] = useActionState(crearRedireccionAction, inicial);
  return (
    <form action={action} className="fo-card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="fo-label">Dirección vieja</span>
          <input name="desde" className="fo-input" placeholder="/sobre" autoComplete="off" spellCheck={false} maxLength={500} required />
          <p className="fo-helper">Sin el dominio. Terminala en * para cubrir todo lo que empiece igual (por ejemplo /proof/*).</p>
        </label>
        <label className="block space-y-2">
          <span className="fo-label">Lleva a</span>
          <input name="hacia" className="fo-input" placeholder="/quien-soy" autoComplete="off" spellCheck={false} maxLength={2000} required />
          <p className="fo-helper">Una página de tu sitio (/quien-soy) o una dirección completa (https://…).</p>
        </label>
      </div>
      <label className="block space-y-2 sm:max-w-xs">
        <span className="fo-label">Tipo</span>
        <select name="codigo" className="fo-input" defaultValue="301">
          <option value="301">Permanente (301): la dirección vieja ya no vuelve</option>
          <option value="302">Temporal (302): por un tiempo</option>
        </select>
      </label>
      {state.error ? <p className="text-sm text-[var(--fo-danger)]" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-[var(--fo-muted)]" role="status">Redirección guardada.</p> : null}
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
        {pending ? "Guardando…" : "Agregar redirección"}
      </button>
    </form>
  );
}

function Lista({ canEdit, redirecciones }: { canEdit: boolean; redirecciones: RedireccionDeLista[] }) {
  if (redirecciones.length === 0) {
    return <p className="fo-card text-sm text-[var(--fo-muted)]">Todavía no hay redirecciones.</p>;
  }
  return (
    <div className="fo-card space-y-2">
      <p className="text-sm text-[var(--fo-muted)]">{redirecciones.length === 1 ? "1 redirección" : `${redirecciones.length} redirecciones`}</p>
      <ul className="divide-y divide-[var(--fo-border)]">
        {redirecciones.map((r) => (
          <Fila key={r.id} canEdit={canEdit} r={r} />
        ))}
      </ul>
    </div>
  );
}

function Fila({ canEdit, r }: { canEdit: boolean; r: RedireccionDeLista }) {
  const [state, action, pending] = useActionState(borrarRedireccionAction, inicial);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0 space-y-0.5">
        <p className="break-all text-[var(--fo-text)]">
          <code>{r.desde}</code> → <code>{r.hacia}</code>
        </p>
        <p className="fo-helper">
          {r.codigo === 302 ? "Temporal" : "Permanente"}
          {r.origen === ORIGEN_ALBOOM ? " · de la web anterior (Alboom)" : ""}
        </p>
        {state.error ? <p className="text-[var(--fo-danger)]" role="alert">{state.error}</p> : null}
      </div>
      {canEdit ? (
        <form action={action}>
          <input type="hidden" name="id" value={r.id} />
          <button type="submit" className="fo-btn fo-btn-danger-outline text-xs" disabled={pending}>
            {pending ? "Quitando…" : "Quitar"}
          </button>
        </form>
      ) : null}
    </li>
  );
}
