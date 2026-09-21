"use client";

import { useState, useTransition } from "react";

import { reenviarVerificacionAction } from "../../actions/judgePublicSignup";

export function ReenviarVerificacion() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  if (mensaje) return <span className="text-fr-muted-soft">{mensaje}</span>;

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() =>
        empezar(async () => {
          const r = await reenviarVerificacionAction();
          setMensaje(r.mensaje);
        })
      }
      className="underline underline-offset-2 hover:text-fr-primary disabled:opacity-50"
    >
      {pendiente ? "Enviando…" : "Reenviar el correo"}
    </button>
  );
}
