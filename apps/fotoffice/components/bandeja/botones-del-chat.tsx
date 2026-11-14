"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { devolverAlBotAction, excluirDelBotAction, resolverAction, tomarAction } from "@/app/actions/bandeja";

type Resultado = { ok: true } | { ok: false; error: string };

/** Tomar, Devolver al bot, Resolver y excluir el número del bot. Sólo se dibuja para quien puede operar; el servidor lo vuelve a exigir. */
export function BotonesDelChat({
  chatId,
  puedeTomar,
  puedeDevolver,
  puedeResolver,
  botExcluido,
}: {
  chatId: string;
  puedeTomar: boolean;
  puedeDevolver: boolean;
  puedeResolver: boolean;
  /** El bot nunca atiende este número. */
  botExcluido: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function correr(accion: () => Promise<Resultado>) {
    setError(null);
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: "No se pudo completar la acción. Probá de nuevo." }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {puedeTomar ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => correr(() => tomarAction(chatId))}>
            Tomar
          </button>
        ) : null}
        {puedeDevolver && !botExcluido ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => correr(() => devolverAlBotAction(chatId))}>
            Devolver al bot
          </button>
        ) : null}
        {puedeResolver ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => correr(() => resolverAction(chatId))}>
            Resolver
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="text-xs text-[var(--fo-muted)] underline"
        disabled={pendiente}
        onClick={() => correr(() => excluirDelBotAction(chatId, !botExcluido))}
      >
        {botExcluido ? "El bot no atiende este número · Volver a activarlo" : "Que el bot no atienda nunca este número"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
