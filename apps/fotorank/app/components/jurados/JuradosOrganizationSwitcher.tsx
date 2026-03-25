"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { setFotorankActiveOrganization } from "../../actions/fotorank-active-org";

type Org = { id: string; name: string; slug: string };

export function JuradosOrganizationSwitcher({
  organizations,
  currentOrganizationId,
  label = "Organización activa (Jurados)",
  className = "",
}: {
  organizations: Org[];
  currentOrganizationId: string | null;
  /** Texto de la etiqueta (sidebar global vs. módulo Jurados). */
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (organizations.length <= 1) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor="jurados-active-org" className="text-xs font-medium uppercase tracking-wide text-fr-muted">
        {label}
      </label>
      <div className="flex min-w-0 flex-col items-stretch gap-2">
        <select
          id="jurados-active-org"
          className="w-full rounded-lg border border-fr-border bg-fr-bg-elevated px-3 py-2.5 text-sm text-fr-primary"
          value={currentOrganizationId ?? ""}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            setError(null);
            startTransition(async () => {
              const res = await setFotorankActiveOrganization(next);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {!currentOrganizationId ? (
            <option value="" disabled>
              Elegí una organización…
            </option>
          ) : null}
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
