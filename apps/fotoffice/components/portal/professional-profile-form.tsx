"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ProfessionalPresenceFields,
  type PresenciaDefaults,
} from "@/components/membership/professional-presence-fields";
import {
  savePortalProfileAction,
  type PortalProfileState,
} from "@/app/actions/portal-profile";

const initial: PortalProfileState = { error: null, ok: null };

export function ProfessionalProfileForm({
  institutionName,
  defaults,
}: {
  institutionName: string;
  defaults: PresenciaDefaults;
}) {
  const [state, submit, pending] = useActionState(savePortalProfileAction, initial);

  return (
    <form action={submit} className="space-y-4">
      <ProfessionalPresenceFields
        institutionName={institutionName}
        defaults={defaults}
        intro={`Esto es lo que ${institutionName} usa para recomendarte y difundir tu trabajo. Actualizalo cuando quieras.`}
      />

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="text-sm text-[var(--fo-success)]">{state.ok}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="fo-btn fo-btn-primary text-sm">
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <Link href="/portal" className="fo-btn fo-btn-secondary text-sm">
          Volver
        </Link>
      </div>
    </form>
  );
}
