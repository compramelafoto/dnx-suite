"use client";

import { useState, useTransition } from "react";

import {
  pedirConfirmacionDeCorreoAction,
  type EstadoDeLaConfirmacion,
} from "../../actions/judgeSessionBridge";
import { FALTA_CONFIRMAR_EL_CORREO } from "../../lib/fotorank/judges/puenteDeSesion";

/**
 * Lo que ve quien ya entró a FotoRank, es jurado, y está a un paso de no
 * necesitar nunca más una segunda contraseña.
 *
 * Reemplaza al formulario de acceso en ese caso: pedirle una clave que
 * probablemente no recuerda, teniendo la sesión abierta al lado, es el
 * problema que este puente vino a sacar.
 */
export function ConfirmarCorreoParaEntrar({ email }: { email: string }) {
  const [estado, setEstado] = useState<EstadoDeLaConfirmacion>({ info: null, error: null });
  const [enviando, iniciar] = useTransition();

  if (estado.info) {
    return (
      <div
        className="rounded-xl border border-fr-border bg-fr-card px-5 py-4 text-sm leading-relaxed text-fr-muted"
        role="status"
      >
        {estado.info}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-fr-muted">{FALTA_CONFIRMAR_EL_CORREO}</p>

      <p className="text-sm text-fr-primary">{email}</p>

      <button
        type="button"
        disabled={enviando}
        onClick={() =>
          iniciar(async () => {
            setEstado(await pedirConfirmacionDeCorreoAction());
          })
        }
        className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
        data-testid="judge-bridge-verify"
      >
        {enviando ? "Enviando…" : "Mandarme el enlace"}
      </button>

      {estado.error ? (
        <p className="text-sm text-red-200" role="alert">
          {estado.error}
        </p>
      ) : null}
    </div>
  );
}
