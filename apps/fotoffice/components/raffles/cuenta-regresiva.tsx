"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Cuenta regresiva hasta el sorteo, para la página que se proyecta.
 *
 * Cuando llega la hora vuelve a pedir la página cada pocos segundos: el servidor resuelve el
 * sorteo en cuanto sale el número público, y la pantalla del salón pasa sola al bolillero sin
 * que nadie tenga que tocar nada.
 */
export function CuentaRegresiva({ drawsAt }: { drawsAt: string }) {
  const router = useRouter();
  const objetivo = new Date(drawsAt).getTime();
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setAhora(Date.now());
    tick();
    const reloj = setInterval(tick, 1000);
    return () => clearInterval(reloj);
  }, []);

  const llego = ahora !== null && ahora >= objetivo;

  useEffect(() => {
    if (!llego) return;
    router.refresh();
    const reintento = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(reintento);
  }, [llego, router]);

  if (ahora === null) return <div className="h-24" aria-hidden />;

  if (llego) {
    return (
      <p className="animate-pulse text-center text-2xl font-semibold text-[var(--fo-accent-hover)]">
        Sorteando…
      </p>
    );
  }

  const resto = Math.max(0, Math.floor((objetivo - ahora) / 1000));
  const partes = [
    { valor: Math.floor(resto / 86400), rotulo: "días" },
    { valor: Math.floor((resto % 86400) / 3600), rotulo: "horas" },
    { valor: Math.floor((resto % 3600) / 60), rotulo: "minutos" },
    { valor: resto % 60, rotulo: "segundos" },
  ];

  return (
    <div className="flex justify-center gap-3 sm:gap-5" role="timer" aria-live="off">
      {partes.map((p) => (
        <div key={p.rotulo} className="min-w-16 rounded-[var(--fo-radius)] bg-[var(--fo-surface-muted)] px-3 py-3 text-center sm:min-w-24">
          <p className="text-3xl font-semibold tabular-nums sm:text-5xl">{String(p.valor).padStart(2, "0")}</p>
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">{p.rotulo}</p>
        </div>
      ))}
    </div>
  );
}
