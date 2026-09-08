"use client";

import { useState } from "react";
import { disconnectIntegrationAction } from "./actions";

/**
 * Desconectar es una acción difícil de deshacer —hay que volver a pedirle permiso a
 * Google—, así que pide confirmación y dice con todas las letras qué deja de funcionar.
 */
export function DisconnectButton({
  integrationKey,
  label,
  consequence,
}: {
  integrationKey: string;
  label: string;
  consequence: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-[var(--fo-danger)] underline underline-offset-4"
      >
        Desconectar
      </button>
    );
  }

  return (
    <form action={disconnectIntegrationAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="integrationKey" value={integrationKey} />
      <p className="text-xs text-[var(--fo-danger)] text-right max-w-xs leading-relaxed">
        Al desconectar {label}, {consequence}
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary text-xs inline-flex">
          Sí, desconectar
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-[var(--fo-muted)] underline underline-offset-4"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
