"use client";

import { useActionState, useState } from "react";
import { sendTestEmailAction, type TestEmailState } from "@/app/workspace/configuracion/actions";
import { PER_USER_HOURLY_LIMIT } from "@/lib/communications/constants";

/**
 * Herramienta de diagnóstico: manda UN email de prueba por el mismo camino que usan las
 * comunicaciones reales.
 *
 * Dos pasos a propósito. El primero pide la dirección; el segundo la muestra escrita y pide
 * confirmar. La confirmación se manda como campo del formulario y el servidor la exige
 * también, así que no es solo una cortesía visual.
 *
 * La dirección se escribe siempre a mano. No se precarga el email de contacto ni el del
 * primer OWNER: mandar a una dirección que la persona no tipeó es mandar a ciegas.
 */

const INITIAL: TestEmailState = { status: "NOT_CONFIRMED", message: "" };

function Feedback({ state }: { state: TestEmailState }) {
  if (!state.message) return null;
  const ok = state.status === "SENT";
  return (
    <p
      role="status"
      className={`text-sm leading-relaxed ${ok ? "text-[var(--fo-success,#047857)]" : "text-[var(--fo-danger,#b91c1c)]"}`}
    >
      {state.message}
    </p>
  );
}

export function TestEmailPanel() {
  const [state, action, pending] = useActionState(sendTestEmailAction, INITIAL);
  const [to, setTo] = useState("");
  const [confirming, setConfirming] = useState(false);

  const trimmed = to.trim();

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--fo-border)] p-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Enviar email de prueba</h3>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          Comprueba que el envío de correo está bien configurado. Sale por el mismo camino que
          las comunicaciones reales y lleva la firma de arriba. No crea cursos, socios ni
          invitaciones.
        </p>
      </div>

      <form action={action} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium">Enviar a</span>
          <input
            type="email"
            name="to"
            value={to}
            required
            onChange={(event) => {
              setTo(event.target.value);
              // Cambiar el destinatario invalida la confirmación: se confirma una dirección
              // concreta, no el acto de enviar.
              setConfirming(false);
            }}
            placeholder="tu@email.com"
            className="w-full rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] px-4 py-3 text-sm"
          />
        </label>

        {/* El servidor exige este campo: sin él la acción responde NOT_CONFIRMED. */}
        <input type="hidden" name="confirm" value={confirming ? "yes" : ""} />

        {confirming ? (
          <div className="space-y-3 rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg)] p-4">
            <p className="text-sm leading-relaxed">
              Se enviará un email de prueba a <strong>{trimmed}</strong>.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
                {pending ? "Enviando…" : "Confirmar envío"}
              </button>
              <button
                type="button"
                className="fo-btn"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="fo-btn"
            onClick={() => setConfirming(true)}
            disabled={!trimmed || pending}
          >
            Enviar email de prueba
          </button>
        )}
      </form>

      <Feedback state={state} />

      <p className="text-xs text-[var(--fo-muted-soft)]">
        Hasta {PER_USER_HOURLY_LIMIT} pruebas por hora.
      </p>
    </section>
  );
}
