"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { addInternalNoteAction } from "@/lib/admin-registration/actions/registrations";
import { adminRoutes } from "@/config/admin/navigation";

type Props = {
  registrationId: string;
};

export function InternalNoteForm({ registrationId }: Props) {
  const router = useRouter();
  const bound = addInternalNoteAction.bind(null, registrationId);
  const [state, formAction, pending] = useActionState(bound, undefined);

  useEffect(() => {
    if (state?.ok) {
      router.push(`${adminRoutes.registrations}/${registrationId}?flash=note_added`);
      router.refresh();
    }
  }, [state, router, registrationId]);

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border p-4">
      {state?.message && !state.ok ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {state.message}
        </p>
      ) : null}
      <Field id="note" label="Observación interna" required error={state?.errors?.note}>
        <textarea
          id="note"
          name="note"
          rows={3}
          defaultValue={state?.values?.note}
          className="min-h-24 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3 text-base"
        />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} disabled={pending}>
        Agregar nota
      </Button>
      <p className="text-xs text-ck-text-muted">
        Solo visible para administración. Se guarda como auditoría INTERNAL_NOTE (sin campo
        Notes dedicado en schema).
      </p>
    </form>
  );
}
