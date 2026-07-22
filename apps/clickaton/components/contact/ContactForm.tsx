"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  submitContactMessageAction,
  type ContactFormState,
} from "@/lib/contact/actions";
import {
  CONTACT_REASON_OPTIONS,
  type ContactReasonValue,
} from "@/lib/contact/reasons";

type Props = {
  defaultReason?: ContactReasonValue;
  source?: string;
};

const initialState: ContactFormState = { ok: false };

export function ContactForm({
  defaultReason = "general",
  source = "contacto",
}: Props) {
  const [state, formAction, pending] = useActionState(
    submitContactMessageAction,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-6" noValidate>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot */}
      <div className="hidden" aria-hidden>
        <label htmlFor="contact-website">Sitio web</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <Field
        id="contact-name"
        label="Nombre"
        hint="Como preferís que te nombremos."
        required
        error={state.fieldErrors?.name}
      >
        <Input
          name="name"
          placeholder="Tu nombre"
          autoComplete="name"
          required
          disabled={pending}
        />
      </Field>

      <Field
        id="contact-email"
        label="Email"
        hint="Solo se usará para responder tu consulta."
        required
        error={state.fieldErrors?.email}
      >
        <Input
          name="email"
          type="email"
          placeholder="nombre@empresa.com"
          autoComplete="email"
          required
          disabled={pending}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="contact-company"
          label="Empresa u organización"
          hint="Opcional."
          error={state.fieldErrors?.company}
        >
          <Input
            name="company"
            placeholder="Nombre de la empresa"
            autoComplete="organization"
            disabled={pending}
          />
        </Field>
        <Field
          id="contact-phone"
          label="Teléfono"
          hint="Opcional."
          error={state.fieldErrors?.phone}
        >
          <Input
            name="phone"
            type="tel"
            placeholder="+54 …"
            autoComplete="tel"
            disabled={pending}
          />
        </Field>
      </div>

      <Field
        id="contact-reason"
        label="Motivo"
        required
        error={state.fieldErrors?.reason}
      >
        <Select name="reason" defaultValue={defaultReason} required disabled={pending}>
          {CONTACT_REASON_OPTIONS.map((reason) => (
            <option key={reason.value} value={reason.value}>
              {reason.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id="contact-message"
        label="Mensaje"
        hint="Contanos cómo querés acompañar Clickatón o qué necesitás."
        required
        error={state.fieldErrors?.message}
      >
        <Textarea
          name="message"
          placeholder="Escribí tu mensaje…"
          rows={5}
          required
          disabled={pending}
        />
      </Field>

      {state.message ? (
        <p
          role="status"
          className={
            state.ok
              ? "rounded-[var(--ck-radius-control)] border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
              : "rounded-[var(--ck-radius-control)] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" loading={pending} className="w-full sm:w-auto">
          {pending ? "Enviando…" : "Enviar mensaje"}
        </Button>
        <p className="ck-caption text-ck-text-muted">
          Llega a la casilla de mensajes del equipo Clickatón.
        </p>
      </div>
    </form>
  );
}
