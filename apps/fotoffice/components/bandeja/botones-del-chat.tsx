"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { devolverAlBotAction, resolverAction, tomarAction } from "@/app/actions/bandeja";

type Resultado = { ok: true } | { ok: false; error: string };

/** Tomar, Devolver al bot y Resolver. Sólo se dibuja para quien puede operar; el servidor lo vuelve a exigir. */
export function BotonesDelChat({
  chatId,
  puedeTomar,
  puedeDevolver,
  puedeResolver,
}: {
  chatId: string;
  puedeTomar: boolean;
  puedeDevolver: boolean;
  puedeResolver: boolean;
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

  if (!puedeTomar && !puedeDevolver && !puedeResolver) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {puedeTomar ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => correr(() => tomarAction(chatId))}>
            Tomar
          </button>
        ) : null}
        {puedeDevolver ? (
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
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
