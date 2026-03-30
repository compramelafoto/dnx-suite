"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  judgeAcceptDirectoryInvitationAction,
  judgeRejectDirectoryInvitationAction,
  judgeArchiveDirectoryInvitationAction,
} from "../../actions/judgeProfessionalDirectory";
import { EXTERNAL_PAYMENT_DISCLAIMER } from "../../lib/fotorank/judges/legalCopy";

type Row = {
  id: string;
  status: string;
  message: string;
  contestTitle: string;
  orgName: string;
  createdAt: string;
  expiresAt: string | null;
  proposedRoleLabel: string | null;
  compensationOfferedText: string | null;
};

export function JudgeDirectoryInvitationsClient({ initial }: { initial: Row[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Error");
      else router.refresh();
    });
  };

  if (initial.length === 0) {
    return (
      <div className="fr-recuadro rounded-xl border border-fr-border bg-fr-card text-center">
        <p className="text-sm text-fr-muted">No tenés invitaciones pendientes.</p>
        <p className="mt-3 text-xs text-fr-muted">{EXTERNAL_PAYMENT_DISCLAIMER}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {err ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{err}</div> : null}
      <p className="text-xs text-fr-muted">{EXTERNAL_PAYMENT_DISCLAIMER}</p>
      <ul className="space-y-4">
        {initial.map((r) => (
          <li key={r.id} className="fr-recuadro rounded-xl border border-fr-border bg-fr-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gold">{r.status}</p>
                <h2 className="font-sans text-lg font-semibold text-fr-primary">{r.contestTitle}</h2>
                <p className="text-sm text-fr-muted">{r.orgName}</p>
                <p className="mt-3 text-sm leading-relaxed text-fr-primary">{r.message}</p>
                {r.proposedRoleLabel ? (
                  <p className="text-xs text-fr-muted">Rol propuesto: {r.proposedRoleLabel}</p>
                ) : null}
                {r.compensationOfferedText ? (
                  <p className="text-xs text-fr-muted">Condiciones ofrecidas: {r.compensationOfferedText}</p>
                ) : null}
                <p className="fr-caption text-fr-muted-soft">
                  Recibida: {new Date(r.createdAt).toLocaleString("es-AR")}
                  {r.expiresAt ? ` · Vence: ${new Date(r.expiresAt).toLocaleString("es-AR")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                {r.status === "PENDING" ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      className="fr-btn fr-btn-primary text-sm"
                      onClick={() => act(() => judgeAcceptDirectoryInvitationAction(r.id))}
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="fr-btn fr-btn-secondary text-sm"
                      onClick={() => act(() => judgeRejectDirectoryInvitationAction(r.id))}
                    >
                      Rechazar
                    </button>
                  </>
                ) : null}
                {r.status === "PENDING" || r.status === "REJECTED" || r.status === "EXPIRED" ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="fr-btn fr-btn-secondary text-xs text-fr-muted"
                    onClick={() => act(() => judgeArchiveDirectoryInvitationAction(r.id))}
                  >
                    Archivar
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
