"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import {
  enviarInvitacionesAction,
  type EnvioState,
} from "@/lib/referrals/admin/enviar-invitaciones-action";

const initialState: EnvioState = { ok: false };

type Props = {
  /** Cuántos recibirían el correo si se manda a todos. */
  destinatarios: number;
  /** Sugerencia de nombre de campaña, con el mes actual. */
  campaniaSugerida: string;
};

export function EnviarInvitacionesForm({ destinatarios, campaniaSugerida }: Props) {
  const [state, action, pending] = useActionState(
    enviarInvitacionesAction,
    initialState,
  );
  const [confirmado, setConfirmado] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <Field
        id="campania"
        label="Campaña"
        hint="Identifica este envío. A nadie le llega dos veces la misma campaña, así que para volver a escribirles más adelante hay que cambiarle el nombre."
      >
        <Input name="campania" defaultValue={campaniaSugerida} required disabled={pending} />
      </Field>

      <div className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-border p-4">
        <p className="text-sm font-semibold text-ck-text">Primero, una prueba</p>
        <Field
          id="soloEmail"
          label="Mandarme el correo a"
          hint="La dirección tiene que tener una inscripción confirmada; si no, el programa no le corresponde y no le llega nada."
        >
          <Input
            name="soloEmail"
            type="email"
            placeholder="tu@email.com"
            disabled={pending}
          />
        </Field>
        <Button
          type="submit"
          name="alcance"
          value="prueba"
          variant="outline"
          disabled={pending}
        >
          {pending ? "Enviando…" : "Enviarme la prueba"}
        </Button>
      </div>

      <div className="space-y-3 rounded-[var(--ck-radius-card)] border border-ck-yellow/40 bg-ck-surface-strong p-4">
        <p className="text-sm font-semibold text-ck-text">
          Después, a toda la comunidad
        </p>
        <p className="text-sm text-ck-text-secondary">
          Le va a llegar a{" "}
          <strong className="text-ck-text">
            {destinatarios} {destinatarios === 1 ? "persona" : "personas"}
          </strong>
          . Un correo enviado no se puede deshacer.
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
          value="todos"
          variant="primary"
          disabled={pending || !confirmado || destinatarios === 0}
        >
          {pending ? "Enviando…" : `Enviar a los ${destinatarios}`}
        </Button>
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
