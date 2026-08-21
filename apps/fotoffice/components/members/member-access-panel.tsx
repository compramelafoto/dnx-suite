"use client";

import { useActionState, useState } from "react";
import type { MemberInvitationRecord } from "@repo/db/fotoffice-members";
import {
  findUserToLinkAction,
  inviteMemberAction,
  linkMemberUserAction,
  revokeMemberInvitationAction,
  unlinkMemberUserAction,
  type MemberAccessState,
} from "@/app/actions/member-access";
import { INVITATION_STATE_LABELS, invitationState } from "@/lib/members/invitations";

const initial: MemberAccessState = { error: null };

function fmt(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/** Cuenta ya vinculada: solo queda la opción de desvincular, con motivo obligatorio. */
function LinkedState({ memberId, userEmail }: { memberId: string; userEmail: string | null }) {
  const [state, action, pending] = useActionState(unlinkMemberUserAction, initial);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--fo-text)]">
        Cuenta vinculada{userEmail ? `: ${userEmail}` : ""}
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="fo-btn fo-btn-secondary text-xs"
        >
          Desvincular cuenta
        </button>
      ) : (
        <form action={action} className="fo-card space-y-2 border-[var(--fo-danger)]/40 p-3">
          <input type="hidden" name="memberId" value={memberId} />
          <p className="text-xs text-[var(--fo-text)]">
            El socio dejará de poder acceder con esa cuenta. La cuenta NO se elimina y conserva sus
            otros accesos. Queda registrado en el historial.
          </p>
          <label className="fo-label text-xs" htmlFor="unlink-reason">
            Motivo (obligatorio)
          </label>
          <input
            id="unlink-reason"
            name="reason"
            required
            maxLength={500}
            placeholder="Ej. El socio pidió cambiar de cuenta"
            className="fo-input !min-h-9 !py-1 text-sm"
          />
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-xs" disabled={pending}>
              {pending ? "…" : "Confirmar desvinculación"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="fo-btn fo-btn-secondary text-xs"
            >
              Cancelar
            </button>
          </div>
          {state.error ? <p className="text-xs text-[var(--fo-danger)]">{state.error}</p> : null}
        </form>
      )}
    </div>
  );
}

/** Buscar una cuenta existente por email exacto y vincularla, con confirmación explícita. */
function LinkExistingUser({ memberId, memberEmail }: { memberId: string; memberEmail: string | null }) {
  const [search, searchAction, searching] = useActionState(findUserToLinkAction, initial);
  const [link, linkAction, linking] = useActionState(linkMemberUserAction, initial);
  const candidate = link.candidate ?? search.candidate;
  const searchedEmail = candidate?.email;

  return (
    <div className="space-y-3">
      <form action={searchAction} className="space-y-2">
        <input type="hidden" name="memberId" value={memberId} />
        <label className="fo-label text-xs" htmlFor="link-email">
          Vincular una cuenta que ya existe
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="link-email"
            name="email"
            type="email"
            required
            placeholder="email exacto de la cuenta"
            className="fo-input !min-h-9 !py-1 text-sm flex-1 min-w-52"
          />
          <button type="submit" className="fo-btn fo-btn-secondary text-xs" disabled={searching}>
            {searching ? "Buscando…" : "Buscar"}
          </button>
        </div>
        <p className="fo-helper">Se busca por email exacto, no por coincidencias parciales.</p>
        {search.error ? <p className="text-xs text-[var(--fo-danger)]">{search.error}</p> : null}
      </form>

      {candidate ? (
        <form action={linkAction} className="fo-card space-y-2 p-3">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="userId" value={candidate.userId} />
          <input type="hidden" name="email" value={searchedEmail} />
          <p className="text-xs text-[var(--fo-text)]">
            Cuenta encontrada: <strong>{candidate.email}</strong>
            {candidate.name ? ` (${candidate.name})` : ""}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            Email del socio: {memberEmail ?? "sin email"}
          </p>

          {!candidate.emailMatchesMember ? (
            <div className="space-y-2 rounded border border-[var(--fo-danger)]/50 p-2">
              <p className="text-xs text-[var(--fo-danger)]">
                Los emails <strong>no coinciden</strong>. Verificá que esta sea realmente la cuenta
                de esta persona: vincularla le dará acceso a su ficha de socio.
              </p>
              <label className="flex items-start gap-2 text-xs text-[var(--fo-text)]">
                <input type="checkbox" name="confirmMismatch" className="mt-0.5" required />
                <span>Confirmo que esta cuenta pertenece a este socio.</span>
              </label>
            </div>
          ) : null}

          <p className="fo-helper">Vincular no otorga permisos de administración.</p>
          <button type="submit" className="fo-btn fo-btn-primary text-xs" disabled={linking}>
            {linking ? "Vinculando…" : "Vincular esta cuenta"}
          </button>
          {link.error ? <p className="text-xs text-[var(--fo-danger)]">{link.error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

/** Invitación: genera el enlace para compartir. No se envía email (no hay proveedor configurado). */
function InviteMember({ memberId, memberEmail }: { memberId: string; memberEmail: string | null }) {
  const [state, action, pending] = useActionState(inviteMemberAction, initial);

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="memberId" value={memberId} />
        <button type="submit" className="fo-btn fo-btn-secondary text-xs" disabled={pending}>
          {pending ? "Generando…" : "Generar invitación de acceso"}
        </button>
      </form>
      <p className="fo-helper">
        {memberEmail
          ? `Se emitirá para ${memberEmail} y vence en 7 días. Copiá el enlace y compartilo con el socio.`
          : "Este socio no tiene email: cargale uno propio para poder invitarlo."}
      </p>
      {state.invitationUrl ? (
        <div className="fo-card space-y-2 p-3">
          <p className="text-xs text-[var(--fo-text)]">
            Enlace generado. <strong>Copialo ahora</strong>: por seguridad no se vuelve a mostrar.
          </p>
          <input
            readOnly
            value={state.invitationUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="fo-input !min-h-9 !py-1 text-xs w-full"
            aria-label="Enlace de invitación"
          />
        </div>
      ) : null}
      {state.error ? <p className="text-xs text-[var(--fo-danger)]">{state.error}</p> : null}
    </div>
  );
}

function InvitationList({
  memberId,
  invitations,
}: {
  memberId: string;
  invitations: MemberInvitationRecord[];
}) {
  const [state, action, pending] = useActionState(revokeMemberInvitationAction, initial);
  if (invitations.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Invitaciones
      </h3>
      <ul className="space-y-1">
        {invitations.map((inv) => {
          const st = invitationState(inv);
          return (
            <li key={inv.id} className="flex flex-wrap items-baseline gap-2 text-xs">
              <span className="text-[var(--fo-text)]">{INVITATION_STATE_LABELS[st]}</span>
              <span className="text-[var(--fo-muted)]">{inv.email}</span>
              <span className="text-[var(--fo-muted-soft)]">
                {st === "PENDING" ? `vence ${fmt(inv.expiresAt)}` : fmt(inv.createdAt)}
              </span>
              {st === "PENDING" ? (
                <form action={action} className="inline">
                  <input type="hidden" name="memberId" value={memberId} />
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <button
                    type="submit"
                    className="text-[var(--fo-danger)] underline"
                    disabled={pending}
                  >
                    revocar
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      {state.error ? <p className="text-xs text-[var(--fo-danger)]">{state.error}</p> : null}
    </div>
  );
}

export function MemberAccessPanel({
  memberId,
  memberEmail,
  linkedUserEmail,
  isLinked,
  invitations,
}: {
  memberId: string;
  memberEmail: string | null;
  linkedUserEmail: string | null;
  isLinked: boolean;
  invitations: MemberInvitationRecord[];
}) {
  return (
    <div className="space-y-5">
      {isLinked ? (
        <LinkedState memberId={memberId} userEmail={linkedUserEmail} />
      ) : (
        <>
          <InviteMember memberId={memberId} memberEmail={memberEmail} />
          <LinkExistingUser memberId={memberId} memberEmail={memberEmail} />
        </>
      )}
      <InvitationList memberId={memberId} invitations={invitations} />
    </div>
  );
}
