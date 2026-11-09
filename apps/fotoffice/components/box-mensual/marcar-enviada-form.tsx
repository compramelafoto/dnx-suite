"use client";

import { useActionState } from "react";
import { marcarBoxEnviadaAction, type BoxActionState } from "@/app/actions/box-mensual";

const initial: BoxActionState = { error: null, ok: null };

/**
 * «Marcar enviada»: la caja que le toca a esta persona. Correo y seguimiento son opcionales; la
 * dirección no se pide acá porque se copia de su ficha en el momento de enviar.
 */
export function MarcarEnviadaForm({
  memberId,
  boxId,
  sinDireccion,
}: {
  memberId: string;
  boxId: string;
  sinDireccion: boolean;
}) {
  const [state, submit, pending] = useActionState(marcarBoxEnviadaAction, initial);

  if (state.ok) return <p className="text-xs text-[var(--fo-success)]">{state.ok}</p>;

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="boxId" value={boxId} />
      <input
        name="carrier"
        placeholder="Correo (opcional)"
        maxLength={120}
        aria-label="Empresa de correo"
        className="fo-input w-36 text-xs"
      />
      <input
        name="trackingCode"
        placeholder="N° de seguimiento (opcional)"
        maxLength={120}
        aria-label="Número de seguimiento"
        className="fo-input w-48 text-xs"
      />
      <button
        type="submit"
        disabled={pending || sinDireccion}
        title={sinDireccion ? "Falta la dirección: cargala en su ficha." : undefined}
        className="fo-btn fo-btn-primary text-xs disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Marcar enviada"}
      </button>
      {state.error ? (
        <p className="w-full text-xs text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
