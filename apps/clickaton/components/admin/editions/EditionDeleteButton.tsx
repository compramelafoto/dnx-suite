"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { deleteEditionAction } from "@/lib/admin/editions/mutations";

type Props = {
  editionId: string;
  canDelete: boolean;
  redirectTo: string;
};

export function EditionDeleteButton({ editionId, canDelete, redirectTo }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("¿Eliminar esta edición en borrador? Esta acción no se puede deshacer.")) {
            return;
          }
          startTransition(async () => {
            const result = await deleteEditionAction(editionId);
            if (!result.ok) {
              setError(result.message ?? "No se pudo eliminar.");
              return;
            }
            router.push(`${redirectTo}?flash=edition_deleted`);
            router.refresh();
          });
        }}
      >
        Eliminar edición
      </Button>
      {error ? <p className="text-sm text-[var(--ck-danger)]">{error}</p> : null}
    </div>
  );
}
