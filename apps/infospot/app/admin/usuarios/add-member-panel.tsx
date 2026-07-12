"use client";

import { useActionState, useState } from "react";
import {
  inviteOrAssignInfoSpotMemberAction,
  lookupDnxUserByEmailAction,
  type LookupUserState,
  type UsersActionState,
} from "@/app/actions/users";

const lookupInitial: LookupUserState = { ok: false, message: "", user: null };
const assignInitial: UsersActionState = { ok: false, message: "" };

export function AddMemberPanel() {
  const [open, setOpen] = useState(false);
  const [lookup, lookupAction, lookupPending] = useActionState(
    lookupDnxUserByEmailAction,
    lookupInitial,
  );
  const [assign, assignAction, assignPending] = useActionState(
    inviteOrAssignInfoSpotMemberAction,
    assignInitial,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-[var(--is-bg)]"
      >
        Invitar o agregar
      </button>
    );
  }

  const showInviteForm =
    (lookup.canInvite && lookup.email) ||
    (lookup.user && !lookup.user.isBlocked);

  return (
    <div className="space-y-8 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--is-text)]">
            Invitar o agregar miembro
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--is-muted)]">
            Buscá por email. Si ya existe en DNX, se asigna el rol. Si no, se crea una
            invitación con enlace seguro (sin contraseña temporal).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
        >
          Cerrar
        </button>
      </div>

      <form action={lookupAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="lookup-email" className="block text-sm font-semibold">
            Email
          </label>
          <input
            id="lookup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="persona@ejemplo.com"
            className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={lookupPending}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-5 text-sm font-semibold disabled:opacity-60"
        >
          {lookupPending ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {lookup.message ? (
        <p
          className={`text-sm leading-relaxed ${lookup.ok ? "text-emerald-800" : "text-red-700"}`}
          role="status"
        >
          {lookup.message}
        </p>
      ) : null}

      {showInviteForm ? (
        <form action={assignAction} className="space-y-6 border-t border-[var(--is-border)] pt-8">
          <input
            type="hidden"
            name="email"
            value={lookup.user?.email ?? lookup.email ?? ""}
          />

          {lookup.user ? (
            <div className="rounded-[var(--is-radius-sm)] bg-[var(--is-bg)] px-4 py-4">
              <p className="font-semibold text-[var(--is-text)]">
                {lookup.user.name?.trim() || lookup.user.email}
              </p>
              <p className="mt-1 text-sm text-[var(--is-muted)]">{lookup.user.email}</p>
              {lookup.user.alreadyMember ? (
                <p className="mt-2 text-xs text-[var(--is-muted)]">
                  Ya es miembro ({lookup.user.currentRole?.replace("INFOSPOT_", "")} ·{" "}
                  {lookup.user.currentStatus}). Al guardar se actualizará.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[var(--is-radius-sm)] bg-[var(--is-bg)] px-4 py-4">
              <p className="font-semibold text-[var(--is-text)]">Nueva invitación</p>
              <p className="mt-1 text-sm text-[var(--is-muted)]">{lookup.email}</p>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="assign-role" className="block text-sm font-semibold">
                Rol
              </label>
              <select
                id="assign-role"
                name="role"
                defaultValue="INFOSPOT_REDACTOR"
                className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3 text-sm"
              >
                <option value="INFOSPOT_REDACTOR">Redactor/a</option>
                <option value="INFOSPOT_COLABORADOR">Colaborador/a</option>
                <option value="INFOSPOT_DIRECTOR">Director/a</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="assign-policy" className="block text-sm font-semibold">
                Política de publicación
              </label>
              <select
                id="assign-policy"
                name="publicationPolicy"
                defaultValue="REQUIRES_APPROVAL"
                className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3 text-sm"
              >
                <option value="DIRECT_PUBLISH">Puede publicar directamente</option>
                <option value="REQUIRES_APPROVAL">Requiere aprobación del Director</option>
              </select>
              <p className="text-xs text-[var(--is-muted)]">
                Solo aplica a Redactores. Director siempre publica; Colaborador siempre requiere aprobación.
              </p>
            </div>
          </div>

          {assign.message ? (
            <p
              className={`text-sm leading-relaxed break-all ${assign.ok ? "text-emerald-800" : "text-red-700"}`}
              role="status"
            >
              {assign.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={assignPending}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
          >
            {assignPending
              ? "Procesando…"
              : lookup.canInvite
                ? "Enviar invitación"
                : "Asignar al equipo"}
          </button>
        </form>
      ) : null}

      {lookup.user?.isBlocked ? (
        <p className="text-sm text-red-700" role="alert">
          Esta cuenta está bloqueada a nivel suite. No se puede asignar.
        </p>
      ) : null}
    </div>
  );
}
