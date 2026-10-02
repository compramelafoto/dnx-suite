"use client";

import { useActionState, useState } from "react";
import {
  changeRoleAction,
  inviteTeamAction,
  removeMemberAction,
  resendInvitationAction,
  revokeInvitationAction,
  type EquipoState,
} from "./actions";

export type MiembroVista = {
  userId: number;
  name: string | null;
  email: string;
  role: string;
  roleLabel: string;
  lastLogin: string;
  esUnoMismo: boolean;
};
export type InvitacionVista = {
  id: string;
  email: string;
  roleLabel: string;
  estado: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  vence: string;
  falloEnvio: boolean;
};
export type EventoVista = { id: string; fecha: string; actor: string; texto: string };
type Opcion = { value: string; label: string };

const ESTADO: Record<InvitacionVista["estado"], string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  REVOKED: "Anulada",
  EXPIRED: "Vencida",
};

function Mensajes({ state }: { state: EquipoState | undefined }) {
  return (
    <>
      {state?.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-sm text-[var(--fo-success)]">{state.ok}</p> : null}
      {state?.warn ? <p className="text-sm text-amber-600">{state.warn}</p> : null}
    </>
  );
}

export function EquipoClient({
  miembros,
  invitaciones,
  eventos,
  rolesInvitar,
  rolesCambiar,
}: {
  miembros: MiembroVista[];
  invitaciones: InvitacionVista[];
  eventos: EventoVista[];
  rolesInvitar: Opcion[];
  rolesCambiar: Opcion[];
}) {
  return (
    <div className="space-y-8">
      <FormularioInvitar roles={rolesInvitar} />

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Quiénes están en el equipo</h2>
        <ul className="divide-y divide-[var(--fo-border)]">
          {miembros.map((m) => (
            <FilaMiembro key={m.userId} m={m} roles={rolesCambiar} />
          ))}
        </ul>
      </section>

      {invitaciones.length > 0 ? (
        <section className="fo-card space-y-4 p-5">
          <h2 className="text-sm font-semibold">Invitaciones</h2>
          <ul className="divide-y divide-[var(--fo-border)]">
            {invitaciones.map((i) => (
              <FilaInvitacion key={i.id} i={i} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Historial</h2>
        {eventos.length === 0 ? (
          <p className="text-xs text-[var(--fo-muted)]">Todavía no hay movimientos.</p>
        ) : (
          <ul className="space-y-2">
            {eventos.map((e) => (
              <li key={e.id} className="text-sm leading-relaxed">
                <span className="text-xs text-[var(--fo-muted-soft)]">{e.fecha}</span>{" "}
                <strong className="font-medium">{e.actor}</strong> {e.texto}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FormularioInvitar({ roles }: { roles: Opcion[] }) {
  const [state, action, pending] = useActionState(
    inviteTeamAction,
    undefined as EquipoState | undefined,
  );
  return (
    <form action={action} className="fo-card space-y-4 p-5">
      <h2 className="text-sm font-semibold">Invitar a alguien</h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          name="email"
          type="email"
          placeholder="correo@ejemplo.com"
          autoComplete="off"
          className="fo-input min-h-11 flex-1"
          aria-label="Correo de la persona"
        />
        <select name="role" className="fo-input min-h-11" aria-label="Rol">
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button type="submit" className="fo-btn fo-btn-primary min-h-11" disabled={pending}>
          {pending ? "Enviando…" : "Invitar"}
        </button>
      </div>
      <Mensajes state={state} />
    </form>
  );
}

function FilaMiembro({ m, roles }: { m: MiembroVista; roles: Opcion[] }) {
  const [cambio, cambiar, cambiando] = useActionState(
    changeRoleAction,
    undefined as EquipoState | undefined,
  );
  const [baja, darDeBaja, dandoBaja] = useActionState(
    removeMemberAction,
    undefined as EquipoState | undefined,
  );
  const [confirmando, setConfirmando] = useState(false);
  // Si el rol actual no se ofrece (p. ej. un dueño mirado por un administrador), se muestra igual.
  const opciones = roles.some((r) => r.value === m.role)
    ? roles
    : [{ value: m.role, label: m.roleLabel }, ...roles];
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {m.name || m.email}
            {m.esUnoMismo ? " (vos)" : ""}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            {m.email} · Último ingreso: {m.lastLogin}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={cambiar} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={m.userId} />
            <select
              name="role"
              defaultValue={m.role}
              className="fo-input min-h-10"
              aria-label={`Rol de ${m.name || m.email}`}
            >
              {opciones.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button type="submit" className="fo-btn fo-btn-ghost" disabled={cambiando}>
              Cambiar rol
            </button>
          </form>
          <form action={darDeBaja} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={m.userId} />
            {confirmando ? (
              <>
                <button type="submit" className="fo-btn fo-btn-primary" disabled={dandoBaja}>
                  Confirmar baja
                </button>
                <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setConfirmando(true)}>
                Dar de baja
              </button>
            )}
          </form>
        </div>
      </div>
      <Mensajes state={cambio} />
      <Mensajes state={baja} />
    </li>
  );
}

function FilaInvitacion({ i }: { i: InvitacionVista }) {
  const [reenvio, reenviar, reenviando] = useActionState(
    resendInvitationAction,
    undefined as EquipoState | undefined,
  );
  const [anulacion, anular, anulando] = useActionState(
    revokeInvitationAction,
    undefined as EquipoState | undefined,
  );
  const activa = i.estado === "PENDING";
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{i.email}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            {i.roleLabel} · {ESTADO[i.estado]}
            {activa ? ` · vence el ${i.vence}` : ""}
            {i.falloEnvio ? " · el correo no pudo enviarse" : ""}
          </p>
        </div>
        {i.estado !== "REVOKED" ? (
          <div className="flex gap-2">
            <form action={reenviar}>
              <input type="hidden" name="invitationId" value={i.id} />
              <button type="submit" className="fo-btn fo-btn-ghost" disabled={reenviando}>
                Reenviar
              </button>
            </form>
            {activa ? (
              <form action={anular}>
                <input type="hidden" name="invitationId" value={i.id} />
                <button type="submit" className="fo-btn fo-btn-ghost" disabled={anulando}>
                  Anular
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
      <Mensajes state={reenvio} />
      <Mensajes state={anulacion} />
    </li>
  );
}
