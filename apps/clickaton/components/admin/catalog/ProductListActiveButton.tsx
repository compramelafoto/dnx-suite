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

export function ProductListActiveButton({ productId, isActive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          const next = !isActive;
          const ok = window.confirm(
            next
              ? "¿Reactivar este producto?"
              : [
                  "¿Desactivar este producto?",
                  "",
                  "• No elimina el registro",
                  "• No modifica inscripciones históricas",
                  "• Evita selección futura",
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
              `${catalogAdminRoutes.products}?flash=${
                next ? "product_activated" : "product_deactivated"
              }`,
            );
            router.refresh();
          });
        }}
      >
        {isActive ? "Desactivar" : "Reactivar"}
      </Button>
      {error ? (
        <p className="text-xs text-[var(--ck-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
