"use client";

import { useActionState, useState } from "react";
import { sendUrgentCommissionNoticeAction, type UrgentNoticeState } from "./actions";
import { enviarSinBorrar, useAlCambiar } from "./estado-accion";

export type PersonaPendiente = {
  memberId: string;
  nombre: string;
  motivo: string;
  /** Por qué no le llega el aviso; `null` si le llega. */
  bloqueo: string | null;
};

function personas(n: number): string {
  return n === 1 ? "1 persona" : `${n} personas`;
}

/**
 * Integrantes que todavía no pueden gestionar la comisión (sin cuenta o con cuotas vencidas) y el
 * botón para mandarles un correo urgente. Pide confirmación antes de enviar.
 */
export function AvisoUrgente({ pendientes }: { pendientes: PersonaPendiente[] }) {
  const [state, dispatch, pending] = useActionState(
    sendUrgentCommissionNoticeAction,
    undefined as UrgentNoticeState | undefined,
  );
  const [confirmando, setConfirmando] = useState(false);
  useAlCambiar(state, (s) => {
    if (s?.ok) setConfirmando(false);
  });

  const destinatarios = pendientes.filter((p) => !p.bloqueo).length;

  return (
    <section className="fo-card space-y-4 border-[var(--fo-warning-border)] p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="font-semibold text-[var(--fo-text)]">Integrantes que todavía no pueden gestionar</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          No activaron su cuenta o tienen cuotas vencidas. Podés mandarles un correo urgente: a quien no tiene
          cuenta le llega un enlace nuevo para activarla; a quien debe, el enlace para pagar.
        </p>
      </div>

      <ul className="divide-y divide-[var(--fo-border)] text-sm">
        {pendientes.map((p) => (
          <li key={p.memberId} className="py-2">
            <span className="font-medium">{p.nombre}</span>
            <span className="block text-[var(--fo-text-secondary)]">{p.motivo}</span>
            {p.bloqueo ? <span className="block text-xs text-[var(--fo-danger)]">{p.bloqueo}</span> : null}
          </li>
        ))}
      </ul>

      {!confirmando ? (
        <button
          type="button"
          className="fo-btn fo-btn-primary min-h-11"
          disabled={destinatarios === 0}
          onClick={() => setConfirmando(true)}
        >
          Enviar aviso urgente
        </button>
      ) : (
        <form
          onSubmit={enviarSinBorrar(dispatch)}
          className="fo-alert-warning w-full space-y-3 rounded-[var(--fo-radius-sm)] p-3"
        >
          <p className="text-sm">
            Se va a mandar un correo a <strong>{personas(destinatarios)}</strong>.
            {destinatarios < pendientes.length
              ? ` ${personas(pendientes.length - destinatarios)} no ${pendientes.length - destinatarios === 1 ? "lo va" : "lo van"} a recibir (ver el motivo en la lista).`
              : ""}
          </p>
          {state?.error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" name="confirm" value="yes" className="fo-btn fo-btn-primary min-h-11" disabled={pending}>
              {pending ? "Enviando…" : "Sí, enviar"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost min-h-11" onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {state?.ok ? <Resultado state={state} /> : null}
    </section>
  );
}

function Resultado({ state }: { state: UrgentNoticeState }) {
  const nada = state.sent.length + state.failed.length + state.skipped.length === 0;
  return (
    <div role="status" className="space-y-2 text-sm">
      {nada ? <p className="text-[var(--fo-muted)]">No había nadie a quien avisarle.</p> : null}
      {state.sent.length > 0 ? (
        <div>
          <p className="font-medium text-[var(--fo-success)]">Enviado a {personas(state.sent.length)}:</p>
          <ul className="list-disc pl-5">
            {state.sent.map((s, i) => (
              <li key={`${s.name}-${i}`}>
                {s.name} — {s.kind === "INVITACION" ? "enlace para activar la cuenta" : "aviso de cuotas pendientes"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.failed.length > 0 ? (
        <div>
          <p className="font-medium text-[var(--fo-danger)]">No salió para {personas(state.failed.length)}:</p>
          <ul className="list-disc pl-5">
            {state.failed.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                {f.name} — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.skipped.length > 0 ? (
        <div>
          <p className="font-medium text-[var(--fo-muted)]">Sin enviar ({personas(state.skipped.length)}):</p>
          <ul className="list-disc pl-5">
            {state.skipped.map((s, i) => (
              <li key={`${s.name}-${i}`}>
                {s.name} — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
