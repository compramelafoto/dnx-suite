"use client";

import { useActionState } from "react";
import { submitPublicCourseLeadAction, type PublicLeadState } from "@/app/actions/public-lead";

const initial: PublicLeadState = { error: null };

export function PublicLeadForm({
  workspaceSlug,
  courseSlug,
  ctaLabel,
}: {
  workspaceSlug: string;
  courseSlug: string;
  ctaLabel: string;
}) {
  const bound = submitPublicCourseLeadAction.bind(null, workspaceSlug, courseSlug);
  const [state, action, pending] = useActionState(bound, initial);

  if (state.ok) {
    return (
      <div className="fo-alert-success rounded-[var(--fo-radius-sm)] p-6 text-center">
        <p className="text-[var(--fo-text)] font-medium">¡Gracias!</p>
        <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
          Recibimos tu consulta. Te vamos a contactar a la brevedad con los siguientes pasos.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="lead-name">
          Nombre y apellido
        </label>
        <input id="lead-name" name="name" required className="fo-input" placeholder="Tu nombre" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="lead-email">
          Email
        </label>
        <input
          id="lead-email"
          name="email"
          type="email"
          required
          className="fo-input"
          placeholder="tu@email.com"
        />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="lead-phone">
          Teléfono (opcional)
        </label>
        <input id="lead-phone" name="phone" className="fo-input" placeholder="+54 …" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="lead-message">
          Mensaje (opcional)
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={3}
          className="fo-input"
          placeholder="Contanos qué te gustaría saber"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary w-full" disabled={pending}>
        {pending ? "Enviando…" : ctaLabel}
      </button>
    </form>
  );
}
