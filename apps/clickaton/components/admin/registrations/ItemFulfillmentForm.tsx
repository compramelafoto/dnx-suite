"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateItemFulfillmentAction } from "@/lib/admin-registration/actions/registrations";
import type { AdminRegistrationActionState } from "@/lib/admin-registration/actions/action-result";
import type { AdminRegistrationDetail } from "@/lib/admin-registration/domain/types";

type Props = {
  registrationId: string;
  itemId: string;
  currentStatus: string;
};

const initial: AdminRegistrationActionState<AdminRegistrationDetail> = {
  ok: true,
};

export function ItemFulfillmentForm({ registrationId, itemId, currentStatus }: Props) {
  const bound = updateItemFulfillmentAction.bind(null, registrationId);
  const [state, action, pending] = useActionState(bound, initial);

  return (
    <form action={action} className="flex w-full min-w-0 flex-col gap-3">
      <input type="hidden" name="registrationItemId" value={itemId} />
      {currentStatus !== "DELIVERED" ? (
        <>
          <input type="hidden" name="nextStatus" value="DELIVERED" />
          <Button type="submit" variant="primary" disabled={pending} className="min-h-11 w-full sm:w-auto">
            Marcar como entregado
          </Button>
        </>
      ) : (
        <>
          <input type="hidden" name="nextStatus" value="PENDING" />
          <label className="space-y-2 text-sm">
            <span className="text-ck-text-secondary">Motivo de la reversión</span>
            <Input
              name="reason"
              placeholder="Ej.: se entregó por error"
              required
              minLength={3}
              aria-describedby={`fulfill-revert-hint-${itemId}`}
            />
            <span id={`fulfill-revert-hint-${itemId}`} className="block text-xs text-ck-text-muted">
              La entrega volverá a pendiente. Podés registrarla de nuevo después.
            </span>
          </label>
          <Button
            type="submit"
            variant="secondary"
            disabled={pending}
            className="min-h-11 w-full sm:w-auto"
            onClick={(e) => {
              if (
                !window.confirm(
                  "¿Revertir la entrega?\n\nEl kit volverá a quedar pendiente. Podés marcarlo como entregado otra vez.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            Revertir entrega
          </Button>
        </>
      )}
      {!state.ok ? (
        <p className="w-full text-sm text-[var(--ck-danger)]" role="alert">
          {state.message ?? "No pudimos actualizar la entrega. Intentá nuevamente."}
        </p>
      ) : state.message ? (
        <p className="w-full text-sm text-ck-text-secondary" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
