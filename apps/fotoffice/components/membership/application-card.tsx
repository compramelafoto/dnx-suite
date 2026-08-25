"use client";

import { useActionState, useState } from "react";
import {
  approveApplicationAction,
  rejectApplicationAction,
  type ApplicationFormState,
} from "@/app/actions/membership-applications";
import type { InboxItem } from "@/lib/membership/inbox";

const initial: ApplicationFormState = { error: null, ok: null };

const ESCALA_LABEL: Record<string, string> = {
  PLENA: "Profesional — cuota plena",
  REDUCIDA: "Estudiante — cuota reducida (50%)",
  EXENTA: "Exenta",
};

function formatArs(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2 }).format(n);
}

export function ApplicationCard({ item }: { item: InboxItem }) {
  const [approveState, approve, approving] = useActionState(approveApplicationAction, initial);
  const [rejectState, reject, rejecting] = useActionState(rejectApplicationAction, initial);
  const [showReject, setShowReject] = useState(false);

  const state = approveState.error || approveState.ok ? approveState : rejectState;

  return (
    <article className="fo-card space-y-4 p-5">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-semibold">{item.fullName}</h3>
          <p className="text-xs text-[var(--fo-muted)]">{item.email}</p>
          <p className="text-xs text-[var(--fo-muted)]">
            {ESCALA_LABEL[item.declaredFeeScale] ?? item.declaredFeeScale}
            {item.categoryName ? ` · ${item.categoryName}` : ""}
          </p>
        </div>
        {item.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.avatarUrl}
            alt={`Foto de ${item.fullName}`}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : null}
      </header>

      {item.notices.map((n, i) =>
        n.kind === "REQUIERE_CONFIRMACION" ? (
          <p key={i} className="text-xs text-[var(--fo-danger)] leading-relaxed">
            ⚠️ Declara condición de estudiante
            {n.institution ? ` en ${n.institution}` : ""}. Verificá el certificado antes de
            aprobar: paga el 50%.
          </p>
        ) : (
          <p key={i} className="text-xs text-[var(--fo-muted)] leading-relaxed">
            ℹ️ Ya fue socio N° <strong>{n.memberNumber}</strong>
            {n.leftAt ? `, baja en ${n.leftAt.toLocaleDateString("es-AR")}` : ""}. Deuda
            registrada: <strong>${formatArs(n.debtArs)}</strong>.
          </p>
        ),
      )}

      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        {item.documentNumber ? (
          <div>
            <dt className="text-[var(--fo-muted-soft)]">Documento</dt>
            <dd>{item.documentNumber}</dd>
          </div>
        ) : null}
        {item.phone ? (
          <div>
            <dt className="text-[var(--fo-muted-soft)]">Teléfono</dt>
            <dd>{item.phone}</dd>
          </div>
        ) : null}
        {item.noticeAddress ? (
          <div className="sm:col-span-2">
            <dt className="text-[var(--fo-muted-soft)]">Domicilio de notificaciones</dt>
            <dd>
              {item.noticeAddress}
              {item.city ? `, ${item.city}` : ""}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[var(--fo-muted-soft)]">Solicitud</dt>
          <dd>{item.createdAt.toLocaleDateString("es-AR")}</dd>
        </div>
      </dl>

      {state.error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-xs text-[var(--fo-success)]">{state.ok}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--fo-border)] pt-3">
        <form action={approve}>
          <input type="hidden" name="applicationId" value={item.id} />
          <button
            type="submit"
            disabled={approving || rejecting}
            className="fo-btn fo-btn-primary text-sm min-h-9"
          >
            {approving ? "Aprobando…" : "Aprobar"}
          </button>
        </form>

        {showReject ? (
          <form action={reject} className="flex flex-1 flex-wrap items-center gap-2">
            <input type="hidden" name="applicationId" value={item.id} />
            <input
              name="reason"
              required
              placeholder="Motivo del rechazo"
              className="fo-input flex-1 text-sm"
              aria-label="Motivo del rechazo"
            />
            <button
              type="submit"
              disabled={rejecting}
              className="fo-btn fo-btn-danger-outline text-sm min-h-9"
            >
              {rejecting ? "…" : "Confirmar rechazo"}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="fo-btn fo-btn-secondary text-sm min-h-9"
          >
            Rechazar
          </button>
        )}
      </div>
    </article>
  );
}
