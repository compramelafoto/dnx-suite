"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setTicketTypeActiveAction } from "@/lib/admin-catalog/actions/tickets";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";

type Props = {
  ticketTypeId: string;
  isActive: boolean;
  redirectTo?: "detail" | "list";
};

export function TicketActiveToggle({
  ticketTypeId,
  isActive,
  redirectTo = "detail",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          const next = !isActive;
          const ok = window.confirm(
            next
              ? "¿Reactivar esta entrada? Volverá a poder venderse según su período."
              : [
                  "¿Desactivar esta entrada?",
                  "",
                  "• No elimina el registro",
                  "• No modifica inscripciones históricas",
                  "• Evita selección futura",
                ].join("\n"),
          );
          if (!ok) return;
          startTransition(async () => {
            const result = await setTicketTypeActiveAction(ticketTypeId, next);
            if (!result.ok) {
              setError(result.message ?? "No se pudo cambiar el estado.");
              return;
            }
            const flash = next ? "ticket_activated" : "ticket_deactivated";
            const href =
              redirectTo === "list"
                ? `${catalogAdminRoutes.tickets}?flash=${flash}`
                : `${catalogAdminRoutes.ticketDetail(ticketTypeId)}?flash=${flash}`;
            router.push(href);
            router.refresh();
          });
        }}
      >
        {isActive ? "Desactivar entrada" : "Reactivar entrada"}
      </Button>
      {error ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
