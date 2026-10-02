"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El bolillero.
 *
 * ── Lo que hay que entender de este archivo ──
 *
 * Esta animación **no sortea nada**. El resultado ya está sellado en la base antes de que la
 * página se pinte, y salió de una cuenta que cualquiera puede rehacer. El bolillero es la
 * manera de contarlo, no la manera de decidirlo. Si alguien recarga la página, gira otra vez y
 * termina en el mismo lugar.
 *
 * Se escribe así a propósito: la tentación de "sortear en el navegador para que sea más
 * emocionante" es exactamente lo que haría el resultado imposible de verificar.
 */

export type BolilleroPremio = {
  prizeTitle: string;
  partnerName: string | null;
  partnerLogoUrl: string | null;
  winnerPosition: number;
  winnerLabel: string;
};

const DURACION_MS = 2600;
const CUADRO_MS = 60;

export function Bolillero({
  entrantLabels,
  prizes,
}: {
  /** Los números de socio del padrón, en orden de posición. Sólo para la animación. */
  entrantLabels: string[];
  prizes: BolilleroPremio[];
}) {
  const [indice, setIndice] = useState(0);
  const [girando, setGirando] = useState(false);
  const [mostrado, setMostrado] = useState<string | null>(null);
  const [resueltos, setResueltos] = useState<number[]>([]);
  const [saltado, setSaltado] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const sinAnimacion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    // El array se copia acá: al desmontar, `timers.current` podría ya apuntar a otro lado, y
    // los relojes que quedaran vivos seguirían pintando sobre un componente que no está.
    const pendientes = timers.current;
    return () => pendientes.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (saltado || sinAnimacion || indice >= prizes.length) return;

    setGirando(true);
    const inicio = Date.now();

    // Desacelera hacia el final: el intervalo entre cuadros crece con el cuadrado del avance.
    // No hay azar acá — el destino ya está decidido; sólo se dibuja el camino.
    const tick = () => {
      const avance = (Date.now() - inicio) / DURACION_MS;
      if (avance >= 1) {
        setMostrado(prizes[indice].winnerLabel);
        setGirando(false);
        setResueltos((r) => [...r, indice]);
        timers.current.push(setTimeout(() => setIndice((i) => i + 1), 1400));
        return;
      }
      const azaroso = entrantLabels[Math.floor(Math.random() * entrantLabels.length)];
      setMostrado(azaroso ?? "—");
      timers.current.push(setTimeout(tick, CUADRO_MS + avance * avance * 340));
    };
    tick();
    // `indice` es el único disparador: cada premio arranca su propio giro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, saltado, sinAnimacion]);

  const mostrarTodo = saltado || sinAnimacion;

  return (
    <div className="space-y-6">
      {!mostrarTodo && indice < prizes.length ? (
        <div className="fo-card flex flex-col items-center gap-4 p-8 text-center">
          {prizes[indice].partnerLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prizes[indice].partnerLogoUrl}
              alt={prizes[indice].partnerName ?? ""}
              className="size-16 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-white object-contain p-1.5"
            />
          ) : null}
          <p className="text-sm text-[var(--fo-muted)]">{prizes[indice].prizeTitle}</p>
          <p
            className={`font-mono text-4xl tabular-nums transition-opacity ${
              girando ? "opacity-60" : "opacity-100"
            }`}
            aria-hidden
          >
            {mostrado ?? "—"}
          </p>
          <button
            type="button"
            className="fo-btn fo-btn-ghost text-sm"
            onClick={() => {
              timers.current.forEach(clearTimeout);
              setSaltado(true);
            }}
          >
            Saltar la animación
          </button>
        </div>
      ) : null}

      {/* Lo que ya salió, y todo de una si se saltó la animación. El aria-live es lo que
          escucha un lector de pantalla: la animación de arriba está oculta para él. */}
      <ul className="space-y-3" aria-live="polite">
        {prizes.map((p, i) =>
          mostrarTodo || resueltos.includes(i) ? (
            <li key={i} className="fo-card flex items-start gap-3 p-6">
              {p.partnerLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.partnerLogoUrl}
                  alt={p.partnerName ?? ""}
                  className="size-12 shrink-0 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-white object-contain p-1"
                />
              ) : null}
              <div className="space-y-1">
              <p className="text-sm text-[var(--fo-muted)]">
                {p.prizeTitle}
                {p.partnerName ? ` — lo dona ${p.partnerName}` : ""}
              </p>
              <p className="text-lg font-semibold">{p.winnerLabel}</p>
              <p className="text-xs text-[var(--fo-muted)]">
                Salió la posición {p.winnerPosition} del padrón.
              </p>
              </div>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}
