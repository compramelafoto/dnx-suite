"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AuthorAction } from "@/lib/store/artworks/consent-basis";
import { respondConsentAction } from "./actions";

/** Retirar y no aceptar piden confirmación; aceptar no (se puede retirar después). */
const CONFIRMAR: Partial<Record<AuthorAction, string>> = {
  withdraw:
    "¿Retirás tu obra de la tienda? Deja de estar a la venta enseguida. Los pedidos que ya se pagaron se entregan igual. Esto no se puede deshacer desde acá.",
  decline: "¿No aceptás que tu obra se venda en la tienda? No se va a publicar. Esto no se puede deshacer desde acá.",
};

const ETIQUETA: Record<AuthorAction, string> = {
  accept: "Acepto",
  decline: "No acepto",
  withdraw: "Retirar mi obra de la tienda",
};

const CLASE: Record<AuthorAction, string> = {
  accept: "fo-btn fo-btn-primary",
  decline: "fo-btn fo-btn-secondary",
  withdraw: "fo-btn fo-btn-danger-outline",
};

export function ConsentActions({
  workspaceSlug,
  token,
  actions,
}: {
  workspaceSlug: string;
  token: string;
  actions: AuthorAction[];
}) {
  const router = useRouter();
  const [enviando, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState<AuthorAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  function responder(action: AuthorAction) {
    setError(null);
    startTransition(async () => {
      const r = await respondConsentAction(workspaceSlug, token, action);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setConfirmando(null);
      router.refresh();
    });
  }

  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      {confirmando ? (
        <div className="space-y-3 rounded-lg border border-[var(--fo-border)] p-4">
          <p className="text-sm">{CONFIRMAR[confirmando]}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="fo-btn fo-btn-danger"
              disabled={enviando}
              onClick={() => responder(confirmando)}
            >
              {enviando ? "Guardando…" : "Sí, confirmo"}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost" disabled={enviando} onClick={() => setConfirmando(null)}>
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              className={CLASE[a]}
              disabled={enviando}
              onClick={() => (CONFIRMAR[a] ? setConfirmando(a) : responder(a))}
            >
              {enviando && !CONFIRMAR[a] ? "Guardando…" : ETIQUETA[a]}
            </button>
          ))}
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
