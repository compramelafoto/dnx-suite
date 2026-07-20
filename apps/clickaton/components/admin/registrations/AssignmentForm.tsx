"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { updateRegistrationAssignmentAction } from "@/lib/admin-registration/actions/registrations";
import { adminRoutes } from "@/config/admin/navigation";

type Option = { id: string; label: string };

type Props = {
  registrationId: string;
  ticketTypeId: string;
  venueId: string | null;
  ticketOptions: Option[];
  venueOptions: Option[];
  enabled: boolean;
};

export function AssignmentForm({
  registrationId,
  ticketTypeId,
  venueId,
  ticketOptions,
  venueOptions,
  enabled,
}: Props) {
  const router = useRouter();
  const bound = updateRegistrationAssignmentAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(bound, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.push(`${adminRoutes.registrations}/${registrationId}?flash=assignment_updated`);
      router.refresh();
    }
  }, [state, router, registrationId]);

  if (!enabled) {
    return (
      <p className="text-sm text-ck-text-muted" role="status">
        La reasignación de sede/entrada solo está disponible en borrador, pago pendiente o lista
        de espera.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-4">
      {state?.message && !state.ok ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field id="ticketTypeId" label="Entrada" required error={state?.errors?.ticketTypeId}>
        <select
          id="ticketTypeId"
          name="ticketTypeId"
          defaultValue={ticketTypeId}
          className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
        >
          {ticketOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="venueId" label="Sede" error={state?.errors?.venueId}>
        <select
          id="venueId"
          name="venueId"
          defaultValue={venueId ?? ""}
          className="min-h-11 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
        >
          <option value="">Sin sede específica</option>
          {venueOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>
      <Field id="reason" label="Motivo" required error={state?.errors?.reason}>
        <Input name="reason" defaultValue={state?.values?.reason} />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
        Guardar asignación
      </Button>
    </form>
  );
}
