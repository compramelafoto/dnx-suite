"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  saveTestimonialModuleSettingsAction,
  type ModuleSettingsState,
} from "@/lib/testimonials/admin/module-settings";

const initialState: ModuleSettingsState = { ok: false };

export function TestimonialModuleSettingsForm({
  editionId,
  editionName,
  enabled,
  delayDays,
}: {
  editionId: string;
  editionName: string;
  enabled: boolean;
  delayDays: number;
}) {
  const [state, action, pending] = useActionState(
    saveTestimonialModuleSettingsAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-4 border-t border-ck-border py-4 first:border-t-0 first:pt-0"
    >
      <input type="hidden" name="editionId" value={editionId} />

      <span className="min-w-40 flex-1 text-sm text-ck-text">{editionName}</span>

      <label className="flex items-center gap-2 text-sm text-ck-text">
        <input
          type="checkbox"
          name="testimonialsEnabled"
          defaultChecked={enabled}
          disabled={pending}
          className="h-5 w-5 accent-[var(--color-ck-yellow)]"
        />
        Encuesta y testimonios
      </label>

      <label className="space-y-1 text-sm">
        <span className="block text-ck-text-muted">Días para invitar</span>
        <input
          type="number"
          name="testimonialInviteDelayDays"
          min={0}
          max={60}
          defaultValue={delayDays}
          disabled={pending}
          className="min-h-11 w-24 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-3 text-ck-text"
        />
      </label>

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>

      {state.message ? (
        <span
          role="status"
          className={
            state.ok
              ? "text-sm text-[var(--ck-success)]"
              : "text-sm text-[var(--ck-danger)]"
          }
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
