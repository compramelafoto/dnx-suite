"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setRegistrationStatusAction } from "@/lib/admin-registration/actions/registrations";
import { ADMIN_TRANSITION_PLANS } from "@/lib/admin-registration/domain/transitions";
import type { AdminRegistrationAction } from "@/lib/admin-registration/domain/types";
import type { ClickatonRegistrationStatus } from "@/lib/registration/domain/types";
import { adminRoutes } from "@/config/admin/navigation";

type Props = {
  registrationId: string;
  status: ClickatonRegistrationStatus;
};

export function RegistrationTransitionButtons({ registrationId, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const plans = ADMIN_TRANSITION_PLANS.filter((p) => p.from.includes(status));

  if (plans.length === 0) {
    return (
      <p className="text-sm text-ck-text-muted" role="status">
        No hay acciones administrativas disponibles para este estado.
      </p>
    );
  }

  function run(action: AdminRegistrationAction, label: string, effects: string[]) {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Indicá un motivo (mín. 3 caracteres) antes de confirmar.");
      return;
    }
    const ok = window.confirm(
      [`¿${label}?`, "", ...effects.map((e) => `• ${e}`), "", `Motivo: ${trimmed}`].join("\n"),
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await setRegistrationStatusAction(registrationId, action, trimmed);
      if (!result.ok) {
        setError(result.message ?? "No se pudo actualizar el estado.");
        return;
      }
      router.push(
        `${adminRoutes.registrations}/${registrationId}?flash=registration_updated`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-4">
      <div>
        <label htmlFor="transition-reason" className="ck-label text-ck-text">
          Motivo de la acción *
        </label>
        <textarea
          id="transition-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-2 min-h-24 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base"
          aria-describedby="transition-reason-hint"
        />
        <p id="transition-reason-hint" className="mt-2 text-xs text-ck-text-muted">
          Queda registrado en historial y auditoría. Obligatorio.
        </p>
      </div>
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
        {plans.map((plan) => (
          <Button
            key={plan.action}
            type="button"
            variant={plan.action === "cancel" || plan.action === "disqualify" ? "outline" : "primary"}
            disabled={pending}
            title={plan.description}
            className="min-h-11 w-full sm:w-auto"
            onClick={() => run(plan.action, plan.label, plan.effects)}
          >
            {plan.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {error.includes("desde estado")
            ? "No pudimos actualizar la inscripción con esa acción en el estado actual."
            : (error || "No pudimos actualizar la inscripción. Intentá nuevamente.")}
        </p>
      ) : null}
    </div>
  );
}
