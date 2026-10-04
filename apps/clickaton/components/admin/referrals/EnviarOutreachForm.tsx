"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import {
  enviarOutreachAction,
  type OutreachState,
} from "@/lib/referrals/admin/enviar-outreach-action";

const initialState: OutreachState = { ok: false };

type Props = {
  pendientes: number;
  total: number;
  tandaMaxima: number;
  campaniaSugerida: string;
};

export function EnviarOutreachForm({
  pendientes,
  total,
  tandaMaxima,
  campaniaSugerida,
}: Props) {
  const [state, action, pending] = useActionState(enviarOutreachAction, initialState);
  const [confirmado, setConfirmado] = useState(false);
  const [tanda, setTanda] = useState(Math.min(50, tandaMaxima));

  const enEstaTanda = Math.min(tanda, pendientes);

  return (
    <form action={action} className="space-y-5">
      <Field
        id="campania-outreach"
        label="Campaña"
        hint="Nadie recibe dos veces la misma campaña. Para volver a escribirles más adelante, cambiale el nombre."
      >
        <Input name="campania" defaultValue={campaniaSugerida} required disabled={pending} />
      </Field>

      <div className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border p-4">
        <p className="text-sm font-semibold text-ck-text">Primero, una prueba</p>
        <Field
          id="soloEmail-outreach"
          label="Mandarme el correo a"
          hint="Tiene que ser una dirección de la lista de contactos."
        >
          <Input name="soloEmail" type="email" placeholder="tu@email.com" disabled={pending} />
        </Field>
        <Button type="submit" name="alcance" value="prueba" variant="outline" disabled={pending}>
          {pending ? "Enviando…" : "Enviarme la prueba"}
        </Button>
      </div>

      <div className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-yellow/40 bg-ck-surface-strong p-4">
        <p className="text-sm font-semibold text-ck-text">Después, por tandas</p>

        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Son <strong className="text-ck-text">{total}</strong> fotógrafos que nunca
          interactuaron con Clickatón. Mandarlos todos juntos es la forma más rápida de
          juntar quejas de spam, y lo que se cae con la reputación del dominio no es este
          correo: son las confirmaciones de pago.
        </p>

        <Field id="limite" label={`Cuántos en esta tanda (máximo ${tandaMaxima})`}>
          <Input
            name="limite"
            type="number"
            min={1}
            max={tandaMaxima}
            value={tanda}
            onChange={(e) => setTanda(Number(e.target.value))}
            disabled={pending}
          />
        </Field>

        <p className="text-sm text-ck-text-secondary">
          Pendientes: <strong className="text-ck-text">{pendientes}</strong>. En esta tanda
          saldrían <strong className="text-ck-text">{enEstaTanda}</strong>.
        </p>

        <label className="flex items-start gap-2 text-sm text-ck-text-secondary">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            disabled={pending}
          />
          <span>Ya me mandé la prueba y el correo está como quiero.</span>
        </label>

        <Button
          type="submit"
          name="alcance"
          value="tanda"
          variant="primary"
          disabled={pending || !confirmado || enEstaTanda === 0}
        >
          {pending ? "Enviando…" : `Enviar tanda de ${enEstaTanda}`}
        </Button>

        <p className="text-xs text-ck-text-muted">
          Después de cada tanda, mirá los rebotes antes de seguir con la siguiente.
        </p>
      </div>

      {state.message ? (
        <p
          role="status"
          className={
            state.ok
              ? "text-sm text-[var(--ck-success)]"
              : "text-sm text-[var(--ck-danger)]"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
