"use client";

import { useActionState } from "react";
import type { ConsentKind } from "@/lib/coverages/consents";
import {
  submitCoverageRequestAction,
  type CoverageRequestFormState,
} from "@/app/actions/coverage-request";

const inicial: CoverageRequestFormState = { error: null, ok: null };

/** Un permiso ya resuelto por el servidor: etiqueta, texto de la versión vigente y si es obligatorio. */
export type ConsentItem = {
  kind: ConsentKind;
  label: string;
  text: string;
  required: boolean;
};

/**
 * El formulario público.
 *
 * Lo completa alguien que no conoce el sistema, casi siempre desde el teléfono. De ahí las
 * decisiones de forma: una sola columna, campos táctiles de 44 px para arriba, y los permisos
 * al final con su texto completo a la vista en vez de detrás de un enlace que nadie abre.
 *
 * `useActionState` deja el botón deshabilitado mientras se envía, que es lo que evita el doble
 * pedido cuando la conexión está lenta y la persona vuelve a apretar.
 *
 * Los permisos llegan ya armados desde `page.tsx` (`ConsentItem[]`), en vez de importar acá
 * `CONSENT_KINDS`/`CONSENT_LABELS`/`REQUIRED_CONSENTS` de `lib/coverages/consents`: ese módulo
 * usa `node:crypto` (`hashConsentText`) a nivel de módulo, y Webpack no puede empaquetarlo para
 * el cliente. Sólo el tipo `ConsentKind` cruza la frontera, como `import type` — se borra en
 * la compilación y no arrastra el módulo.
 */
export function CoverageRequestForm({
  workspaceSlug,
  institutionName,
  intro,
  consents,
}: {
  workspaceSlug: string;
  institutionName: string;
  intro: string | null;
  consents: ConsentItem[];
}) {
  const accion = submitCoverageRequestAction.bind(null, workspaceSlug);
  const [state, formAction, pending] = useActionState(accion, inicial);

  if (state.ok) {
    return (
      <section className="fo-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Listo, lo recibimos</h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{state.ok}</p>
        {state.publicCode ? (
          <p className="text-sm">
            Tu número es{" "}
            <strong className="tabular-nums">{state.publicCode}</strong>. Anotalo por las dudas.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {intro ? (
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{intro}</p>
      ) : null}

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Quiénes son</legend>
        <Campo name="orgName" label="Nombre de la organización" required />
        <Campo name="orgKind" label="Qué tipo de organización es" />
        <Campo name="orgTaxId" label="CUIT, si tienen" />
        <Campo name="orgWebsite" label="Sitio o redes" />
        <Campo name="contactName" label="Con quién hablamos" required />
        <Campo name="contactRole" label="Qué rol tiene" />
        <Campo name="contactEmail" label="Correo" type="email" required />
        <Campo name="contactPhone" label="Teléfono o WhatsApp" />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Qué actividad es</legend>
        <Campo name="eventTitle" label="Cómo se llama" required />
        <Campo name="eventDescription" label="Contanos de qué se trata" textarea />
        <Campo name="startsAt" label="Cuándo empieza" type="datetime-local" required />
        <Campo name="endsAt" label="Cuándo termina" type="datetime-local" required />
        <Campo name="addressLine" label="Dirección" />
        <Campo name="city" label="Localidad" />
        <Campo name="expectedAttendees" label="Cuánta gente esperan" type="number" />
        <Campo name="onSiteContactName" label="Quién va a estar ese día" />
        <Campo name="onSitePhone" label="Su teléfono" />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Qué necesitan</legend>
        <Campo name="purpose" label="Para qué van a usar las fotos" textarea />
        <Campo name="keyMoments" label="Qué momentos no se pueden perder" textarea />
        <Campo name="requestedPhotographers" label="Cuántos fotógrafos creen que hacen falta" type="number" />
        <Campo name="expectedDeliveryAt" label="Para cuándo las necesitan" type="date" />
        <Campo name="documentationLinks" label="Enlaces que nos ayuden a conocerlos" textarea />
        <Campo name="notes" label="Algo más que quieran contarnos" textarea />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Permisos</legend>
        <p className="text-sm text-[var(--fo-muted)]">
          Leé cada uno. Los marcados con * son necesarios para que {institutionName} pueda
          tomar el pedido.
        </p>
        {consents.map((c) => (
          <label key={c.kind} className="flex gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              name={`consent_${c.kind}`}
              className="mt-1 size-5 shrink-0"
              required={c.required}
            />
            <span>
              <span className="font-medium">
                {c.label}
                {c.required ? " *" : ""}
              </span>
              <br />
              <span className="text-[var(--fo-muted)]">{c.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="fo-btn min-h-12 w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar el pedido"}
      </button>
    </form>
  );
}

function Campo({
  name,
  label,
  type = "text",
  required = false,
  textarea = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const clases =
    "w-full min-h-11 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-base";
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      {textarea ? (
        <textarea name={name} rows={3} className={clases} required={required} />
      ) : (
        <input name={name} type={type} className={clases} required={required} />
      )}
    </label>
  );
}
