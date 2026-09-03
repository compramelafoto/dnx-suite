"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Cuenta regresiva hasta la apertura conjunta de consignas.
 *
 * El reloj del teléfono no decide nada: se toma el desfase contra `serverNow`
 * al montar y todo se mide contra la hora del servidor. Al llegar a cero pide
 * a la página que se recargue, y sigue reintentando hasta que el servidor
 * devuelva las consignas (nunca las revela por su cuenta).
 */

type Props = {
  opensAtIso: string;
  serverNowIso: string;
  promptCount: number;
  timezone: string;
};

function twoDigits(value: number): string {
  return String(Math.max(0, value)).padStart(2, "0");
}

function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function PromptsCountdown({ opensAtIso, serverNowIso, promptCount, timezone }: Props) {
  const router = useRouter();
  const opensAt = useMemo(() => new Date(opensAtIso).getTime(), [opensAtIso]);
  const skewRef = useRef(0);
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, opensAt - new Date(serverNowIso).getTime()),
  );
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    skewRef.current = new Date(serverNowIso).getTime() - Date.now();
  }, [serverNowIso]);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, opensAt - (Date.now() + skewRef.current));
      setRemaining(left);
      setOpening(left === 0);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [opensAt]);

  // Al llegar a cero la página se vuelve a pedir al servidor, que es quien
  // decide si ya corresponde mostrar las consignas.
  useEffect(() => {
    if (!opening) return;
    router.refresh();
    const id = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(id);
  }, [opening, router]);

  const { days, hours, minutes, seconds } = splitRemaining(remaining);
  const fechaApertura = new Date(opensAtIso);
  const horaLocal = `${fechaApertura.toLocaleDateString("es-AR", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  })} a las ${fechaApertura.toLocaleTimeString("es-AR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })} h`;

  const bloques: Array<{ label: string; value: string }> = [
    ...(days > 0 ? [{ label: days === 1 ? "día" : "días", value: String(days) }] : []),
    { label: "horas", value: twoDigits(hours) },
    { label: "min", value: twoDigits(minutes) },
    { label: "seg", value: twoDigits(seconds) },
  ];

  return (
    <div className="space-y-6">
      {/* Marco de visor: las esquinas encuadran el número, como en la cámara. */}
      <div className="relative mx-auto w-full max-w-xs px-4 py-7">
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 size-7 border-l-2 border-t-2 border-ck-yellow/70" />
        <span aria-hidden className="pointer-events-none absolute right-0 top-0 size-7 border-r-2 border-t-2 border-ck-yellow/70" />
        <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 size-7 border-b-2 border-l-2 border-ck-yellow/70" />
        <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 size-7 border-b-2 border-r-2 border-ck-yellow/70" />

        <p className="ck-overline text-center text-ck-text-muted">
          {opening ? "Abriendo" : "Faltan"}
        </p>

        <div
          className="mt-4 flex items-end justify-center gap-4 sm:gap-7"
          role="timer"
          aria-live="off"
        >
          {bloques.map((bloque) => (
            <div key={bloque.label} className="flex flex-col items-center">
              <span className="font-[family-name:var(--font-ck-display)] text-5xl leading-none tabular-nums text-ck-yellow sm:text-7xl">
                {bloque.value}
              </span>
              <span className="ck-overline mt-2 text-ck-text-muted">{bloque.label}</span>
            </div>
          ))}
        </div>

        {/* Anuncio para lectores de pantalla: solo el hecho, no cada segundo. */}
        <p className="sr-only" aria-live="polite">
          {opening ? "Llegó la hora: las consignas se están abriendo." : ""}
        </p>
      </div>

      <div className="space-y-2 text-center">
        <p className="text-base leading-relaxed text-ck-text">
          {opening
            ? "Llegó la hora. Estamos abriendo las consignas."
            : promptCount > 0
              ? `A esa hora se publican las ${promptCount} consignas, todas juntas.`
              : "A esa hora se publican todas las consignas, juntas."}
        </p>
        <p className="text-sm text-ck-text-muted">Apertura: {horaLocal}</p>
      </div>
    </div>
  );
}
