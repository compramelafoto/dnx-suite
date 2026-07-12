"use client";

import { useActionState } from "react";
import {
  resendInfoSpotInvitationAction,
  revokeInfoSpotInvitationAction,
  type UsersActionState,
} from "@/app/actions/users";

const initial: UsersActionState = { ok: false, message: "" };

export type PendingInviteCardData = {
  id: string;
  email: string;
  roleLabel: string;
  canPublish: boolean;
  invitedAtLabel: string;
  expiresAtLabel: string;
  invitedByLabel: string;
  lastSentLabel: string;
};

export function PendingInviteCard({ invite }: { invite: PendingInviteCardData }) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendInfoSpotInvitationAction,
    initial,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokeInfoSpotInvitationAction,
    initial,
  );

  return (
    <article className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border)] bg-[var(--is-surface)] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h3 className="truncate text-lg font-semibold tracking-tight text-[var(--is-text)]">
            {invite.email}
          </h3>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex min-h-8 items-center rounded-full bg-amber-100 px-3 text-xs font-semibold text-amber-900">
              Invitación pendiente
            </span>
            <span className="inline-flex min-h-8 items-center rounded-full bg-[var(--is-bg-secondary)] px-3 text-xs font-semibold text-[var(--is-text-secondary)]">
              {invite.roleLabel}
            </span>
          </div>
          <p className="text-xs text-[var(--is-muted)]">
            Invitó {invite.invitedByLabel} · {invite.invitedAtLabel} · vence{" "}
            {invite.expiresAtLabel}
            {invite.lastSentLabel ? ` · último envío ${invite.lastSentLabel}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={resendAction}>
          <input type="hidden" name="invitationId" value={invite.id} />
          <button
            type="submit"
            disabled={resendPending}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
          >
            {resendPending ? "…" : "Reenviar invitación"}
          </button>
        </form>
        <form action={revokeAction}>
          <input type="hidden" name="invitationId" value={invite.id} />
          <button
            type="submit"
            disabled={revokePending}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] px-4 text-sm font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-60"
          >
            {revokePending ? "…" : "Revocar"}
          </button>
        </form>
      </div>

      {resendState.message ? (
        <p
          className={`mt-4 text-sm leading-relaxed break-all ${resendState.ok ? "text-emerald-800" : "text-red-700"}`}
        >
          {resendState.message}
        </p>
      ) : null}
      {revokeState.message ? (
        <p className={`mt-4 text-sm ${revokeState.ok ? "text-emerald-800" : "text-red-700"}`}>
          {revokeState.message}
        </p>
      ) : null}
    </article>
  );
}
