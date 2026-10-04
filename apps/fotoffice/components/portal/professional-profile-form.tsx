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
import type { PersonVocabulary } from "@/lib/vocabulario/personas";

const initial: PortalProfileState = { error: null, ok: null };

/**
 * Se usa en dos pantallas: "Mi perfil" y "Mi portfolio".
 *
 * Es el mismo formulario y la misma acción en los dos lugares, a propósito. Duplicarlo haría que
 * un día pidan cosas distintas y nadie sepa cuál manda.
 */
export function ProfessionalProfileForm({
  institutionName,
  defaults,
  vocabulary,
  intro,
  backHref = "/portal",
}: {
  institutionName: string;
  defaults: PresenciaDefaults;
  vocabulary: PersonVocabulary;
  /** Para qué sirve esto, según desde dónde se entre. */
  intro?: string;
  /** `null` saca el enlace de volver: dentro de otra pantalla no va a ningún lado útil. */
  backHref?: string | null;
}) {
  const [state, submit, pending] = useActionState(savePortalProfileAction, initial);

  return (
    <form action={submit} className="space-y-4">
      <ProfessionalPresenceFields
        institutionName={institutionName}
        defaults={defaults}
        vocabulary={vocabulary}
        intro={
          intro ??
          `Esto es lo que ${institutionName} usa para recomendarte y difundir tu trabajo. Actualizalo cuando quieras.`
        }
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
        {backHref ? (
          <Link href={backHref} className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        ) : null}
      </div>
    </form>
  );
}
