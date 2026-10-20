"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmarPuntoAction, type EstadoPreparacion } from "@/app/actions/preparacion";
import type { Punto } from "@/lib/preparacion";

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/**
 * La lista de preparación del evento.
 *
 * Los puntos que el sistema puede ver solos se muestran resueltos, con un enlace a donde
 * se arreglan. Los del salón llevan un botón, porque sólo los sabe quien habló con el
 * salón.
 */
export function Preparacion({ eventoId, puntos }: { eventoId: string; puntos: Punto[] }) {
  const [estado, confirmar, enviando] = useActionState<EstadoPreparacion, FormData>(
    confirmarPuntoAction,
    {},
  );

  return (
    <ul className="mt-6 space-y-3">
      {puntos.map((p) => (
        <li
          key={p.clave}
          className="flex items-start gap-3 rounded-2xl p-4"
          style={{
            background: p.listo ? "transparent" : "var(--slf-crema, #FAF7FF)",
            border: `1px solid ${p.listo ? "var(--slf-borde)" : "#E0A458"}`,
          }}
        >
          <span
            aria-hidden="true"
            className="mt-[2px] text-lg leading-none"
            style={{ color: p.listo ? "#2E7D32" : "#B07400" }}
          >
            {p.listo ? "✓" : p.importancia === "IMPRESCINDIBLE" ? "!" : "·"}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">{p.texto}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
              {p.ayuda}
            </p>

            {p.confirmadoEl ? (
              <p className="mt-2 text-xs" style={{ color: "var(--slf-tinta-suave)" }}>
                Confirmado el {FECHA.format(new Date(p.confirmadoEl))}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-4">
              {/* Los del salón se confirman a mano; los automáticos llevan a resolverlos. */}
              {p.href && !p.listo ? (
                <Link
                  href={p.href}
                  className="text-sm font-extrabold underline underline-offset-4"
                  style={{ color: "var(--slf-violeta-texto)" }}
                >
                  Resolverlo
                </Link>
              ) : null}

              {p.href ? null : (
                <form action={confirmar}>
                  <input type="hidden" name="eventoId" value={eventoId} />
                  <input type="hidden" name="clave" value={p.clave} />
                  <input type="hidden" name="confirmar" value={p.listo ? "0" : "1"} />
                  <button
                    type="submit"
                    disabled={enviando}
                    className="min-h-[40px] rounded-xl px-4 text-sm font-extrabold disabled:opacity-60"
                    style={
                      p.listo
                        ? { color: "var(--slf-tinta-suave)", textDecoration: "underline" }
                        : {
                            background: "var(--slf-violeta-texto)",
                            color: "white",
                          }
                    }
                  >
                    {p.listo ? "Ya no" : "Lo confirmo"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </li>
      ))}

      {estado.error ? (
        <li className="text-sm" style={{ color: "#B3261E" }} aria-live="polite">
          {estado.error}
        </li>
      ) : null}
    </ul>
  );
}
