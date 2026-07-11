"use client";

import { useActionState, useState } from "react";
import {
  closeInfoSpotMemberSessionsAction,
  revokeInfoSpotAccessAction,
  updateInfoSpotMemberAction,
  type UsersActionState,
} from "@/app/actions/users";

const initial: UsersActionState = { ok: false, message: "" };

export type MemberCardData = {
  userId: number;
  name: string;
  email: string;
  role: string;
  status: string;
  canPublish: boolean;
  isSelf: boolean;
  isBlockedSuite: boolean;
  assignedAtLabel: string;
  updatedAtLabel: string;
  assignedByLabel: string;
  lastChangedByLabel: string;
  lastAccessLabel: string;
  needsReview: boolean;
};

function RoleBadge({ role }: { role: string }) {
  const director = role === "INFOSPOT_DIRECTOR";
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold tracking-wide ${
        director
          ? "bg-[var(--is-accent)]/15 text-[var(--is-accent)]"
          : "bg-[var(--is-bg-secondary)] text-[var(--is-text-secondary)]"
      }`}
    >
      {director ? "Director" : "Redactor"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${
        active ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"
      }`}
    >
      {active ? "Activo" : "Desactivado"}
    </span>
  );
}

export function MemberCard({ member }: { member: MemberCardData }) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateInfoSpotMemberAction,
    initial,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeInfoSpotAccessAction,
    initial,
  );
  const [sessionsState, sessionsAction, sessionsPending] = useActionState(
    closeInfoSpotMemberSessionsAction,
    initial,
  );
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  return (
    <article className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h3 className="truncate text-lg font-semibold tracking-tight text-[var(--is-text)]">
            {member.name}
          </h3>
          <p className="truncate text-sm text-[var(--is-muted)]">{member.email}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <RoleBadge role={member.role} />
            <StatusBadge status={member.status} />
            {member.role === "INFOSPOT_REDACTOR" ? (
              <span
                className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-semibold ${
                  member.canPublish
                    ? "bg-sky-100 text-sky-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {member.canPublish ? "Puede publicar" : "Necesita revisión"}
              </span>
            ) : null}
            {member.isBlockedSuite ? (
              <span className="inline-flex min-h-8 items-center rounded-full bg-red-100 px-3 text-xs font-semibold text-red-800">
                Bloqueado suite
              </span>
            ) : null}
            {member.isSelf ? (
              <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--is-border)] px-3 text-xs font-medium text-[var(--is-muted)]">
                Vos
              </span>
            ) : null}
          </div>
        </div>
        <dl className="grid shrink-0 gap-1 text-xs text-[var(--is-muted)] sm:text-right">
          <div>
            <dt className="inline">Asignado: </dt>
            <dd className="inline text-[var(--is-text-secondary)]">{member.assignedAtLabel}</dd>
          </div>
          <div>
            <dt className="inline">Último cambio: </dt>
            <dd className="inline text-[var(--is-text-secondary)]">{member.updatedAtLabel}</dd>
          </div>
          <div>
            <dt className="inline">Último acceso: </dt>
            <dd className="inline text-[var(--is-text-secondary)]">{member.lastAccessLabel}</dd>
          </div>
        </dl>
      </div>

      <form action={updateAction} className="mt-8 space-y-6 border-t border-[var(--is-border)] pt-8">
        <input type="hidden" name="userId" value={member.userId} />
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
              Rol
            </label>
            <select
              name="role"
              defaultValue={member.role}
              disabled={member.isSelf}
              className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3 text-sm disabled:opacity-60"
            >
              <option value="INFOSPOT_REDACTOR">Redactor/a</option>
              <option value="INFOSPOT_DIRECTOR">Director/a</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
              Estado
            </label>
            <select
              name="status"
              defaultValue={member.status}
              disabled={member.isSelf}
              className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-3 text-sm disabled:opacity-60"
            >
              <option value="ACTIVE">Activo</option>
              <option value="DISABLED">Desactivado</option>
            </select>
          </div>
          <label className="flex min-h-11 items-end gap-3 pb-2 text-sm">
            <input
              type="checkbox"
              name="canPublish"
              defaultChecked={member.canPublish || member.role === "INFOSPOT_DIRECTOR"}
              className="size-4"
            />
            Puede publicar
            {member.role === "INFOSPOT_DIRECTOR" ? (
              <span className="text-xs text-[var(--is-muted)]">(siempre en Director)</span>
            ) : null}
          </label>
        </div>

        {updateState.message ? (
          <p className={`text-sm ${updateState.ok ? "text-emerald-800" : "text-red-700"}`}>
            {updateState.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={updatePending}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
          >
            {updatePending ? "Guardando…" : "Guardar cambios"}
          </button>

          {!member.isSelf ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDisable(true)}
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
              >
                Desactivar…
              </button>
              <button
                type="submit"
                formAction={sessionsAction}
                disabled={sessionsPending}
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium disabled:opacity-60"
              >
                {sessionsPending ? "…" : "Cerrar sesiones"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] px-4 text-sm font-medium text-red-700 underline-offset-2 hover:underline"
              >
                Revocar acceso…
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[var(--is-muted)] underline-offset-2 hover:underline"
          >
            {showAudit ? "Ocultar auditoría" : "Ver auditoría"}
          </button>
        </div>
      </form>

      {sessionsState.message ? (
        <p className={`mt-4 text-sm ${sessionsState.ok ? "text-emerald-800" : "text-red-700"}`}>
          {sessionsState.message}
        </p>
      ) : null}
      {revokeState.message ? (
        <p className={`mt-4 text-sm ${revokeState.ok ? "text-emerald-800" : "text-red-700"}`}>
          {revokeState.message}
        </p>
      ) : null}

      {showAudit ? (
        <div className="mt-6 rounded-[var(--is-radius-sm)] bg-[var(--is-bg)] px-4 py-4 text-sm leading-relaxed text-[var(--is-muted)]">
          <p>
            Asignado por:{" "}
            <span className="text-[var(--is-text-secondary)]">{member.assignedByLabel}</span>
          </p>
          <p className="mt-2">
            Último cambio por:{" "}
            <span className="text-[var(--is-text-secondary)]">{member.lastChangedByLabel}</span>
          </p>
          <p className="mt-2">
            Fechas: {member.assignedAtLabel} → {member.updatedAtLabel}
          </p>
        </div>
      ) : null}

      {confirmDisable ? (
        <ConfirmModal
          title="¿Desactivar miembro?"
          body="Perderá acceso a Redacción y Admin hasta que lo reactives. Se cerrarán sus sesiones."
          confirmLabel="Desactivar"
          pending={updatePending}
          onCancel={() => setConfirmDisable(false)}
          onConfirm={updateAction}
          hiddenFields={{
            userId: String(member.userId),
            role: member.role,
            status: "DISABLED",
            ...(member.canPublish ? { canPublish: "on" } : {}),
          }}
        />
      ) : null}

      {confirmRevoke ? (
        <ConfirmModal
          title="¿Revocar acceso?"
          body="El miembro quedará desactivado y se cerrarán todas sus sesiones DNX."
          confirmLabel="Revocar"
          danger
          pending={revokePending}
          onCancel={() => setConfirmRevoke(false)}
          onConfirm={revokeAction}
          hiddenFields={{ userId: String(member.userId) }}
        />
      ) : null}
    </article>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  danger,
  pending,
  onCancel,
  onConfirm,
  hiddenFields,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (payload: FormData) => void;
  hiddenFields: Record<string, string>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <form
        action={onConfirm}
        className="w-full max-w-md space-y-6 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-bg)] p-8 shadow-lg"
      >
        {Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <h4 id="confirm-title" className="text-lg font-semibold tracking-tight">
          {title}
        </h4>
        <p className="text-sm leading-relaxed text-[var(--is-muted)]">{body}</p>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className={`inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] px-4 text-sm font-semibold disabled:opacity-60 ${
              danger
                ? "bg-red-700 text-white"
                : "bg-[var(--is-accent)] text-[var(--is-bg)]"
            }`}
          >
            {pending ? "…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
