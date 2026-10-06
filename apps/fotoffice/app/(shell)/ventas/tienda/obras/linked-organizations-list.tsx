"use client";

import { useState, useTransition } from "react";
import { unlinkOrganizationAction, type ArtworksActionResult } from "./actions";
import { ArtworksResult } from "./artworks-result";

export type LinkedOrganizationView = {
  organizationId: string;
  name: string;
  slug: string;
  linkedAtText: string;
  linkedByName: string | null;
};

export function LinkedOrganizationsList({ organizations }: { organizations: LinkedOrganizationView[] }) {
  const [resultado, setResultado] = useState<ArtworksActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (organizations.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--fo-muted)]">Todavía no vinculaste ninguna organización.</p>
        <ArtworksResult resultado={resultado} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-[var(--fo-border)]">
        {organizations.map((o) => (
          <li key={o.organizationId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{o.name}</p>
              <p className="text-[var(--fo-muted)]">
                {o.slug} · Vinculada el {o.linkedAtText}
                {o.linkedByName ? ` por ${o.linkedByName}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-sm"
              disabled={pendiente}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Desvincular "${o.name}"? Sus obras dejan de mostrarse y venderse en tu tienda. Podés volver a vincularla después.`,
                  )
                ) {
                  return;
                }
                setResultado(null);
                startTransition(async () => setResultado(await unlinkOrganizationAction(o.organizationId)));
              }}
            >
              Desvincular
            </button>
          </li>
        ))}
      </ul>
      <ArtworksResult resultado={resultado} />
    </div>
  );
}
