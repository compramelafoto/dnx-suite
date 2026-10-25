"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ENTREGA_ETIQUETA, type InvitacionVista, type MiembroVista, type RolOfrecido } from "@/lib/team/vista";
import {
  inviteTeamAction,
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  type EquipoState,
} from "./actions";

/** Después de una acción que salió bien, la lista se vuelve a leer (no alcanza con revalidar). */
function useRefrescarAlTerminar(state: EquipoState | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
}

function Mensajes({ state }: { state: EquipoState | undefined }) {
  return (
    <>
      {state?.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-[var(--fo-success)]">{state.ok}</p> : null}
      {state?.warn ? <p className="text-sm text-[var(--fo-warning)]">{state.warn}</p> : null}
      {state?.enlace ? <EnlaceDeInvitacion url={state.enlace} /> : null}
    </>
  );
}

/**
 * El enlace existe sólo en esta respuesta: en la base queda su hash. Por eso se avisa que no se
 * va a volver a ver; si se pierde, "Reenviar" arma uno nuevo (y anula éste).
 */
export function EnlaceDeInvitacion({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] p-3">
      <p className="text-xs text-[var(--fo-muted)]">
        Si el correo no le llega, mandale este enlace por WhatsApp. Se muestra una sola vez; si lo
        perdés, tocá “Reenviar” y se arma uno nuevo.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          aria-label="Enlace de invitación"
          className="fo-input min-h-10 flex-1 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="fo-btn fo-btn-ghost min-h-10"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
        >
          {copiado ? "Copiado" : "Copiar enlace de invitación"}
        </button>
      </div>
    </div>
  );
}

export function EquipoClient({
  miembros,
  invitaciones,
  roles,
}: {
  miembros: MiembroVista[];
  invitaciones: InvitacionVista[];
  roles: RolOfrecido[];
}) {
  return (
    <div className="space-y-8">
      <FormularioInvitar roles={roles} />

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Quiénes están en el equipo</h2>
        <ul className="divide-y divide-[var(--fo-border)]">
          {miembros.map((m) => (
            <FilaMiembro key={m.userId} m={m} />
          ))}
        </ul>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Invitaciones pendientes</h2>
        {invitaciones.length === 0 ? (
          <p className="text-xs text-[var(--fo-muted)]">No hay invitaciones esperando respuesta.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {invitaciones.map((i) => (
              <FilaInvitacion key={i.id} i={i} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FormularioInvitar({ roles }: { roles: RolOfrecido[] }) {
  const [state, action, pending] = useActionState(inviteTeamAction, undefined as EquipoState | undefined);
  useRefrescarAlTerminar(state);
  const porDefecto = roles.some((r) => r.value === "STAFF") ? "STAFF" : (roles[0]?.value ?? "");
  const [elegido, setElegido] = useState(porDefecto);
  return (
    <form action={action} className="fo-card space-y-4 p-5">
      <h2 className="text-sm font-semibold">Invitar a alguien</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          name="email"
          type="email"
          required
          placeholder="correo@ejemplo.com"
          autoComplete="off"
          className="fo-input min-h-11 flex-1"
          aria-label="Correo de la persona"
        />
        <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={pending || roles.length === 0}>
          {pending ? "Enviando…" : "Invitar"}
        </button>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-[var(--fo-muted)]">Rol</legend>
        {roles.map((r) => (
          <label
            key={r.value}
            className="flex cursor-pointer gap-3 rounded-lg border border-[var(--fo-border)] p-3 has-[:checked]:border-[var(--fo-accent)] has-[:checked]:bg-[var(--fo-accent-soft)]"
          >
            <input
              type="radio"
              name="role"
              value={r.value}
              checked={elegido === r.value}
              onChange={() => setElegido(r.value)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{r.label}</span>
              <span className="block text-xs leading-relaxed text-[var(--fo-muted)]">{r.descripcion}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-[var(--fo-muted)]">
        Le llega un correo con un enlace que vence en 7 días. Si todavía no tiene cuenta, la crea
        desde ese mismo enlace.
      </p>
      <Mensajes state={state} />
    </form>
  );
}

function FilaMiembro({ m }: { m: MiembroVista }) {
  const [baja, darDeBaja, dandoBaja] = useActionState(removeMemberAction, undefined as EquipoState | undefined);
  useRefrescarAlTerminar(baja);
  const [confirmando, setConfirmando] = useState(false);
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {m.nombre}
            {m.esUnoMismo ? " (vos)" : ""}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            {m.email} · {m.rolEtiqueta} · desde el {m.desde}
          </p>
          {!m.baja.puede && m.baja.motivo ? (
            <p className="text-xs text-[var(--fo-muted-soft)]">{m.baja.motivo}</p>
          ) : null}
        </div>
        {m.baja.puede ? (
          <form action={darDeBaja} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="userId" value={m.userId} />
            {confirmando ? (
              <>
                <span className="text-xs text-[var(--fo-muted)]">¿Le sacás el acceso a {m.nombre}?</span>
                <button type="submit" className="fo-btn fo-btn-primary" disabled={dandoBaja}>
                  Sí, dar de baja
                </button>
                <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setConfirmando(false)}>
                  No
                </button>
              </>
            ) : (
              <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setConfirmando(true)}>
                Dar de baja
              </button>
            )}
          </form>
        ) : null}
      </div>
      <Mensajes state={baja} />
    </li>
  );
}

function FilaInvitacion({ i }: { i: InvitacionVista }) {
  const [reenvio, reenviar, reenviando] = useActionState(resendInvitationAction, undefined as EquipoState | undefined);
  const [anulacion, anular, anulando] = useActionState(revokeInvitationAction, undefined as EquipoState | undefined);
  useRefrescarAlTerminar(anulacion);
  // El reenvío no refresca: la fila se reemplazaría por la nueva y se perdería el enlace recién armado.
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{i.email}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            {i.rolEtiqueta} · enviada el {i.enviada} · {i.vencida ? `venció el ${i.vence}` : `vence el ${i.vence}`} ·{" "}
            <span className={i.entrega === "FALLO" ? "text-[var(--fo-danger)]" : undefined}>
              {ENTREGA_ETIQUETA[i.entrega]}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <form action={reenviar}>
            <input type="hidden" name="invitationId" value={i.id} />
            <button type="submit" className="fo-btn fo-btn-ghost" disabled={reenviando || Boolean(reenvio?.ok)}>
              {reenviando ? "Reenviando…" : "Reenviar"}
            </button>
          </form>
          {!reenvio?.ok ? (
            <form action={anular}>
              <input type="hidden" name="invitationId" value={i.id} />
              <button type="submit" className="fo-btn fo-btn-ghost" disabled={anulando}>
                Cancelar
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <Mensajes state={reenvio} />
      <Mensajes state={anulacion} />
    </li>
  );
}
