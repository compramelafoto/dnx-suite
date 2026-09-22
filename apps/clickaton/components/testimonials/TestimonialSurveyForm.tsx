"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/lib/cn";
import {
  submitTestimonialSurveyAction,
  type TestimonialFormState,
} from "@/lib/testimonials/actions/submit-survey-action";
import {
  ASPECT_MAX,
  IMPROVEMENT_MAX_LENGTH,
  IMPROVEMENT_PRIVACY_NOTICE,
  NPS_MAX,
  NPS_QUESTION,
  QUOTE_MAX_LENGTH,
  QUOTE_QUESTION,
  SURVEY_ASPECTS,
  WOULD_RETURN_OPTIONS,
  type SurveyAspectField,
} from "@/lib/testimonials/domain/survey-definition";
import { toInitials } from "@/lib/testimonials/public/voices-presentation";

export type TestimonialSurveyDefaults = {
  npsScore: number | null;
  scores: Record<SurveyAspectField, number | null>;
  wouldReturn: "YES" | "MAYBE" | "NO" | null;
  improvementNotes: string;
  publicQuote: string;
  authorLinkUrl: string;
  publicationConsent: boolean;
};

type Props = {
  editionSlug: string;
  editionName: string;
  authorName: string;
  authorRoleLabel: string;
  hasPhoto: boolean;
  defaults: TestimonialSurveyDefaults;
  alreadyAnswered: boolean;
};

const initialState: TestimonialFormState = { ok: false };

function NpsScale({ defaultValue }: { defaultValue: number | null }) {
  return (
    <fieldset className="space-y-3">
      <legend className="ck-label text-ck-text">{NPS_QUESTION}</legend>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: NPS_MAX + 1 }, (_, n) => (
          <label
            key={n}
            className="group cursor-pointer"
            aria-label={`${n} de ${NPS_MAX}`}
          >
            <input
              type="radio"
              name="npsScore"
              value={n}
              defaultChecked={defaultValue === n}
              required
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full border border-ck-border",
                "bg-ck-surface text-ck-text transition-colors",
                "peer-checked:border-ck-yellow peer-checked:bg-ck-yellow peer-checked:text-ck-black",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ck-yellow",
              )}
            >
              {n}
            </span>
          </label>
        ))}
      </div>
      <p className="ck-caption text-ck-text-muted">
        0 es «ni loco» y 10 es «ya se lo recomendé a tres».
      </p>
    </fieldset>
  );
}

function AspectRow({
  field,
  label,
  help,
  defaultValue,
}: {
  field: SurveyAspectField;
  label: string;
  help: string;
  defaultValue: number | null;
}) {
  return (
    <fieldset className="border-t border-ck-border pt-4 first:border-t-0 first:pt-0">
      <legend className="ck-label text-ck-text">{label}</legend>
      <p className="ck-caption mb-2 text-ck-text-muted">{help}</p>
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: ASPECT_MAX }, (_, i) => i + 1).map((n) => (
          <label key={n} className="cursor-pointer" aria-label={`${n} de ${ASPECT_MAX}`}>
            <input
              type="radio"
              name={field}
              value={n}
              defaultChecked={defaultValue === n}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border border-ck-border",
                "bg-ck-surface text-ck-text transition-colors",
                "peer-checked:border-ck-yellow peer-checked:bg-ck-yellow peer-checked:text-ck-black",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ck-yellow",
              )}
            >
              {n}
            </span>
          </label>
        ))}
        <label className="cursor-pointer">
          <input
            type="radio"
            name={field}
            value="NA"
            defaultChecked={defaultValue === null}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex h-10 items-center justify-center rounded-full border border-ck-border px-4",
              "bg-ck-surface text-ck-text-muted transition-colors",
              "peer-checked:border-ck-border-strong peer-checked:text-ck-text",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ck-yellow",
            )}
          >
            No aplica
          </span>
        </label>
      </div>
    </fieldset>
  );
}

export function TestimonialSurveyForm({
  editionSlug,
  editionName,
  authorName,
  authorRoleLabel,
  hasPhoto,
  defaults,
  alreadyAnswered,
}: Props) {
  const [state, formAction, pending] = useActionState(
    submitTestimonialSurveyAction,
    initialState,
  );
  const [quoteLength, setQuoteLength] = useState(defaults.publicQuote.length);

  if (state.ok) {
    return (
      <Card variant="yellow" className="space-y-3">
        <h2 className="ck-heading-md text-ck-text">¡Gracias!</h2>
        <p className="ck-body-md text-ck-text-secondary">{state.message}</p>
      </Card>
    );
  }

  return (
    <form action={formAction} className="grid gap-10" noValidate>
      <input type="hidden" name="editionSlug" value={editionSlug} />

      {alreadyAnswered ? (
        <p className="ck-body-md rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4 text-ck-text-secondary">
          Ya nos habías contestado. Podés cambiar lo que quieras y volver a
          enviarlo; si editás tu testimonio, vuelve a pasar por revisión antes de
          publicarse.
        </p>
      ) : null}

      <section className="space-y-4">
        <NpsScale defaultValue={defaults.npsScore} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="ck-heading-md text-ck-text">La relación de calidad</h2>
          <p className="ck-body-md text-ck-text-secondary">
            Del 1 al 5. Lo que no viviste, marcalo como «No aplica».
          </p>
        </div>
        <div className="space-y-4">
          {SURVEY_ASPECTS.map((aspect) => (
            <AspectRow
              key={aspect.field}
              field={aspect.field}
              label={aspect.label}
              help={aspect.help}
              defaultValue={defaults.scores[aspect.field]}
            />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="ck-heading-md text-ck-text">En tus palabras</h2>
          <p className="ck-body-md text-ck-text-secondary">
            Dos cajas distintas, con destinos distintos.
          </p>
        </div>

        <Field
          id="publicQuote"
          label={QUOTE_QUESTION}
          hint={`Sobre ${editionName}. Esto es lo único que podría publicarse, y sólo si nos autorizás abajo. Hasta ${QUOTE_MAX_LENGTH} caracteres.`}
        >
          <Textarea
            name="publicQuote"
            rows={4}
            maxLength={QUOTE_MAX_LENGTH}
            defaultValue={defaults.publicQuote}
            disabled={pending}
            onChange={(e) => setQuoteLength(e.currentTarget.value.length)}
          />
        </Field>
        <p className="ck-caption -mt-4 text-ck-text-muted" aria-live="polite">
          {quoteLength} de {QUOTE_MAX_LENGTH} caracteres.
        </p>

        <Field
          id="improvementNotes"
          label="¿Qué mejorarías? Criticá sin filtro."
          hint={IMPROVEMENT_PRIVACY_NOTICE}
        >
          <Textarea
            name="improvementNotes"
            rows={5}
            maxLength={IMPROVEMENT_MAX_LENGTH}
            defaultValue={defaults.improvementNotes}
            disabled={pending}
          />
        </Field>
      </section>

      <section className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="ck-label text-ck-text">
            ¿Volverías a participar?
          </legend>
          <div className="flex flex-wrap gap-2">
            {WOULD_RETURN_OPTIONS.map((option) => (
              <label key={option.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="wouldReturn"
                  value={option.value}
                  defaultChecked={defaults.wouldReturn === option.value}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex h-10 items-center justify-center rounded-full border border-ck-border px-5",
                    "bg-ck-surface text-ck-text transition-colors",
                    "peer-checked:border-ck-yellow peer-checked:bg-ck-yellow peer-checked:text-ck-black",
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ck-yellow",
                  )}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          id="authorLinkUrl"
          label="Tu Instagram o tu sitio (opcional)"
          hint="Si publicamos tu testimonio, tu nombre lleva a este enlace. Podés poner @tuusuario."
        >
          <Input
            name="authorLinkUrl"
            defaultValue={defaults.authorLinkUrl}
            placeholder="@tuusuario"
            disabled={pending}
          />
        </Field>

        <Card className="space-y-4">
          <p className="ck-label text-ck-text">Así te verías si te publicamos</p>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-ck-border bg-ck-surface text-ck-text-secondary"
            >
              {toInitials(authorName)}
            </span>
            <span className="flex flex-col">
              <span className="ck-body-md text-ck-text">{authorName}</span>
              <span className="ck-caption text-ck-text-muted">
                {authorRoleLabel} · {editionName}
              </span>
            </span>
          </div>
          <p className="ck-caption text-ck-text-muted">
            {hasPhoto
              ? "Va con la foto de perfil de tu inscripción, no con estas iniciales. El nombre también sale de ahí: si querés cambiarlo, hacelo en tu cuenta antes de enviar."
              : "No tenés foto de perfil cargada, así que se publican tus iniciales. El nombre sale de tu inscripción."}
          </p>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="publicationConsent"
              defaultChecked={defaults.publicationConsent}
              disabled={pending}
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-ck-yellow)]"
            />
            <span className="ck-body-md text-ck-text">
              Autorizo a publicar mi testimonio con mi nombre y mi foto en el
              sitio de Clickatón.
              <span className="ck-caption block text-ck-text-muted">
                Sin esta autorización tu respuesta suma a las métricas y no se
                publica nada.
              </span>
            </span>
          </label>
        </Card>
      </section>

      {state.message && !state.ok ? (
        <p
          role="alert"
          className="ck-body-md rounded-[var(--ck-radius-card)] border border-ck-danger p-4 text-ck-text"
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar mi respuesta"}
        </Button>
      </div>
    </form>
  );
}
