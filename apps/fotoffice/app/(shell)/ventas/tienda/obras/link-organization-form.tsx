"use client";

import { useState, useTransition } from "react";
import { linkOrganizationAction, type ArtworksActionResult } from "./actions";
import { ArtworksResult } from "./artworks-result";

export function LinkOrganizationForm({
  organizations,
}: {
  organizations: Array<{ id: string; name: string; slug: string }>;
}) {
  const [resultado, setResultado] = useState<ArtworksActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      // `onSubmit` y no `action`: un error no tiene que borrar lo elegido.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setResultado(null);
        startTransition(async () => setResultado(await linkOrganizationAction(fd)));
      }}
      className="space-y-3"
    >
      <p className="fo-helper">
        Aparecen las organizaciones donde sos dueño o administrador en FotoRank. Al vincular, vas a poder elegir obras de
        sus concursos para tu tienda.
      </p>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="obras-organizationId">
          Organización
        </label>
        <select id="obras-organizationId" name="organizationId" className="fo-input max-w-md" required defaultValue="">
          <option value="" disabled>
            Elegí una organización
          </option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.slug})
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
        {pendiente ? "Vinculando…" : "Vincular"}
      </button>
      <ArtworksResult resultado={resultado} />
    </form>
  );
}
