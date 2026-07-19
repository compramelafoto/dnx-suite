"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setProductActiveAction } from "@/lib/admin-catalog/actions/products";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";

type Props = {
  productId: string;
  isActive: boolean;
};

export function ProductActiveToggle({ productId, isActive }: Props) {
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
              ? "¿Reactivar este producto? Volverá a poder seleccionarse en flujos futuros."
              : [
                  "¿Desactivar este producto?",
                  "",
                  "• No elimina el registro",
                  "• No modifica inscripciones históricas",
                  "• Evita selección futura",
                  "• Puede afectar entradas aún no vendidas que lo referencien",
                ].join("\n"),
          );
          if (!ok) return;
          startTransition(async () => {
            const result = await setProductActiveAction(productId, next);
            if (!result.ok) {
              setError(result.message ?? "No se pudo cambiar el estado.");
              return;
            }
            router.push(
              `${catalogAdminRoutes.productDetail(productId)}?flash=${
                next ? "product_activated" : "product_deactivated"
              }`,
            );
            router.refresh();
          });
        }}
      >
        {isActive ? "Desactivar producto" : "Reactivar producto"}
      </Button>
      {error ? (
        <p className="text-sm text-[var(--ck-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
