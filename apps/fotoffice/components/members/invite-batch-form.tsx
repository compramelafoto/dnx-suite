"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { inviteMembersBatchAction } from "@/app/actions/member-access";
import { INVITE_BATCH_MAX } from "@/lib/members/invitations";

/**
 * Invitación de varios socios desde el padrón.
 *
 * Envuelve la tabla —que se sigue renderizando en el servidor— en un formulario, para que
 * las casillas de cada fila viajen juntas. Lo único que vive en el cliente es la cuenta de
 * seleccionados y el resultado de la tanda.
 *
 * La selección NO se guarda entre páginas del listado a propósito: mostrar "25 seleccionados"
 * de socios que ya no están en pantalla es la forma más fácil de mandar invitaciones sin
 * saber a quién.
 */
export function InviteBatchForm({
  children,
  canManage,
}: {
  children: React.ReactNode;
  canManage: boolean;
}) {
  const [state, action, pending] = useActionState(inviteMembersBatchAction, {
    error: null,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);

  const recount = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const boxes = form.querySelectorAll<HTMLInputElement>('input[name="memberIds"]:checked');
    setSelected(boxes.length);
  }, []);

  /** Marca hasta el tope, en el orden en que aparecen. Nunca más de lo que la acción acepta. */
  const selectUpToMax = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const boxes = Array.from(
      form.querySelectorAll<HTMLInputElement>('input[name="memberIds"]:not(:disabled)'),
    );
    boxes.forEach((box, i) => {
      box.checked = i < INVITE_BATCH_MAX;
    });
    recount();
  }, [recount]);

  const clearAll = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    form
      .querySelectorAll<HTMLInputElement>('input[name="memberIds"]')
      .forEach((box) => (box.checked = false));
    recount();
  }, [recount]);

  const excede = selected > INVITE_BATCH_MAX;

  return (
    <form ref={formRef} action={action} onChange={recount} className="space-y-3">
      {canManage ? (
        <div className="fo-card !p-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || selected === 0 || excede}
            className="fo-btn fo-btn-primary text-sm min-h-10"
          >
            {pending
              ? "Enviando invitaciones…"
              : selected === 0
                ? "Invitar a los seleccionados"
                : `Invitar a ${selected} socio${selected === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={selectUpToMax}
            className="fo-btn fo-btn-secondary text-sm min-h-10"
          >
            Seleccionar hasta {INVITE_BATCH_MAX}
          </button>
          {selected > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="fo-btn fo-btn-ghost text-sm min-h-10"
            >
              Limpiar selección
            </button>
          ) : null}
          <p className="text-xs text-[var(--fo-muted)]">
            Se envía de a {INVITE_BATCH_MAX} por vez. Los socios sin email o que ya tienen
            acceso no se pueden seleccionar.
          </p>
        </div>
      ) : null}

      {excede ? (
        <p className="fo-card !p-4 text-sm text-[var(--fo-danger)]" role="alert">
          Seleccionaste {selected}. El máximo por tanda es {INVITE_BATCH_MAX}.
        </p>
      ) : null}

      {state.error ? (
        <p className="fo-card !p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.sent !== undefined ? (
        <div className="fo-card !p-4 space-y-2" role="status">
          <p className="text-sm text-[var(--fo-success)]">
            {state.sent === 0
              ? "No salió ninguna invitación."
              : `Se enviaron ${state.sent} invitacion${state.sent === 1 ? "" : "es"}.`}
          </p>
          {state.failed && state.failed.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm text-[var(--fo-danger)]">
                {state.failed.length === 1
                  ? "1 socio quedó sin invitar:"
                  : `${state.failed.length} socios quedaron sin invitar:`}
              </p>
              <ul className="text-xs text-[var(--fo-muted)] space-y-0.5">
                {state.failed.map((f) => (
                  <li key={f.memberId}>
                    <a href={`/members/${f.memberId}`} className="underline">
                      Ver socio
                    </a>{" "}
                    — {f.error}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {children}
    </form>
  );
}
