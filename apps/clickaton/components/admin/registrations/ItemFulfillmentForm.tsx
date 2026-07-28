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
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="registrationItemId" value={itemId} />
      {currentStatus !== "DELIVERED" ? (
        <>
          <input type="hidden" name="nextStatus" value="DELIVERED" />
          <Button type="submit" variant="primary" disabled={pending}>
            Marcar entregada
          </Button>
        </>
      ) : (
        <>
          <input type="hidden" name="nextStatus" value="PENDING" />
          <label className="space-y-1 text-xs">
            <span className="text-ck-text-secondary">Motivo de reversión</span>
            <Input name="reason" placeholder="Motivo administrativo" required minLength={3} />
          </label>
          <Button type="submit" variant="secondary" disabled={pending}>
            Revertir entrega
          </Button>
        </>
      )}
      {!state.ok ? (
        <p className="w-full text-sm text-[var(--ck-danger)]" role="alert">
          {state.message}
        </p>
      ) : state.message ? (
        <p className="w-full text-sm text-ck-text-secondary" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
