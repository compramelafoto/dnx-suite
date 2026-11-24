"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { derivarAction, excluirDelBotAction, resolverAction, tomarAction } from "@/app/actions/bandeja";

type Resultado = { ok: true } | { ok: false; error: string };
export type PersonaParaDerivar = { userId: number; nombre: string };

/**
 * Acciones del encabezado del chat: Tomar (atajo para uno mismo), «Derivar a…» (una persona con
 * Gestionar o el bot), Resolver y el menú ⋯ (que el bot no atienda el número). Sólo se dibuja para
 * quien puede operar; el servidor lo vuelve a exigir.
 */
export function BotonesDelChat({
  chatId,
  yo,
  asignadoUserId,
  estado,
  atiendeElBot,
  botExcluido,
  personas,
}: {
  chatId: string;
  yo: number;
  asignadoUserId: number | null;
  estado: "BOT" | "HUMANO" | "RESUELTO";
  atiendeElBot: boolean;
  botExcluido: boolean;
  personas: PersonaParaDerivar[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const derivarRef = useRef<HTMLDetailsElement>(null);
  const masRef = useRef<HTMLDetailsElement>(null);
  const esMio = estado === "HUMANO" && asignadoUserId === yo;

  function correr(accion: () => Promise<Resultado>) {
    setError(null);
    derivarRef.current?.removeAttribute("open");
    masRef.current?.removeAttribute("open");
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: "No se pudo completar la acción. Probá de nuevo." }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  const item = "block w-full rounded-[var(--fo-radius-sm)] px-3 py-1.5 text-left text-sm hover:bg-[var(--fo-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50";
  const menu = "absolute right-0 z-20 mt-1 w-60 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-1 shadow-lg";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!esMio ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => correr(() => tomarAction(chatId))}>
            Tomar
          </button>
        ) : null}
        <details ref={derivarRef} className="relative">
          <summary className="fo-btn fo-btn-secondary cursor-pointer list-none text-sm [&::-webkit-details-marker]:hidden">Derivar a…</summary>
          <div className={menu} role="menu">
            {personas.map((p) => {
              const actual = estado === "HUMANO" && asignadoUserId === p.userId;
              return (
                <button key={p.userId} type="button" role="menuitem" className={item} disabled={pendiente || actual} onClick={() => correr(() => derivarAction(chatId, p.userId))}>
                  {p.nombre}
                  {p.userId === yo ? " (vos)" : ""}
                  {actual ? " · ya lo tiene" : ""}
                </button>
              );
            })}
            <div className="my-1 border-t border-[var(--fo-border)]" />
            <button
              type="button"
              role="menuitem"
              className={item}
              disabled={pendiente || botExcluido || (estado === "BOT" && asignadoUserId === null)}
              title={botExcluido ? "El bot no atiende este número" : undefined}
              onClick={() => correr(() => derivarAction(chatId, "bot"))}
            >
              Bot{botExcluido ? " · no atiende este número" : atiendeElBot ? " · ya lo atiende" : ""}
            </button>
          </div>
        </details>
        {estado !== "RESUELTO" ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => correr(() => resolverAction(chatId))}>
            Resolver
          </button>
        ) : null}
        <details ref={masRef} className="relative">
          <summary aria-label="Más acciones" className="fo-btn fo-btn-secondary cursor-pointer list-none px-2 text-sm [&::-webkit-details-marker]:hidden">
            ⋯
          </summary>
          <div className={menu} role="menu">
            <button type="button" role="menuitem" className={item} disabled={pendiente} onClick={() => correr(() => excluirDelBotAction(chatId, !botExcluido))}>
              {botExcluido ? "Volver a dejar que el bot atienda este número" : "Que el bot no atienda nunca este número"}
            </button>
          </div>
        </details>
      </div>
      {error ? (
        <p role="alert" className="text-right text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
