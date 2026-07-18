"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  deactivateVenueAction,
  deleteVenueAction,
} from "@/lib/admin/venues/mutations";
import { unpublishEditionAction } from "@/lib/admin/editions/mutations";

type VenueProps = {
  venueId: string;
  canDelete: boolean;
  canDeactivate: boolean;
  listHref: string;
};

export function VenueActionButtons({
  venueId,
  canDelete,
  canDeactivate,
  listHref,
}: VenueProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      {canDeactivate ? (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await deactivateVenueAction(venueId);
              if (!result.ok) {
                setError(result.message ?? "No se pudo desactivar.");
                return;
              }
              router.push(`${listHref}?flash=venue_deactivated`);
              router.refresh();
            });
          }}
        >
          Desactivar sede
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("¿Eliminar esta sede? Confirmá que no tiene inscripciones asociadas.")) {
              return;
            }
            startTransition(async () => {
              const result = await deleteVenueAction(venueId);
              if (!result.ok) {
                setError(result.message ?? "No se pudo eliminar.");
                return;
              }
              router.push(`${listHref}?flash=venue_deleted`);
              router.refresh();
            });
          }}
        >
          Eliminar sede
        </Button>
      ) : null}
      {error ? <p className="w-full text-sm text-[var(--ck-danger)]">{error}</p> : null}
    </div>
  );
}

type UnpublishProps = {
  editionId: string;
  isPublished: boolean;
};

export function EditionUnpublishButton({ editionId, isPublished }: UnpublishProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!isPublished) return null;

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await unpublishEditionAction(editionId);
          router.refresh();
        });
      }}
    >
      Despublicar
    </Button>
  );
}
