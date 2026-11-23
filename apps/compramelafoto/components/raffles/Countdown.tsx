"use client";

import { useEffect, useState } from "react";

/** Cuenta regresiva hasta una fecha. Antes de montar no muestra números, para no desfasar el servidor. */
export default function Countdown({ to, tone = "dark" }: { to: string; tone?: "dark" | "light" }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setAhora(Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const resto = ahora === null ? null : Math.max(0, new Date(to).getTime() - ahora);
  const partes =
    resto === null
      ? null
      : [
          { n: Math.floor(resto / 86_400_000), l: "días" },
          { n: Math.floor((resto / 3_600_000) % 24), l: "horas" },
          { n: Math.floor((resto / 60_000) % 60), l: "min" },
          { n: Math.floor((resto / 1000) % 60), l: "seg" },
        ];
  const oscuro = tone === "dark";

  return (
    <div className="flex gap-2 sm:gap-3" aria-live="off">
      {(partes ?? [{ l: "días" }, { l: "horas" }, { l: "min" }, { l: "seg" }]).map((p, i) => (
        <div
          key={i}
          className={`flex min-w-[3.5rem] flex-col items-center rounded-2xl px-2 py-2 sm:min-w-[4.5rem] sm:py-3 ${
            oscuro ? "bg-white/10 text-white ring-1 ring-white/15 backdrop-blur" : "bg-[#fdf6ef] text-[#111827]"
          }`}
        >
          <span className="text-2xl font-bold tabular-nums sm:text-3xl">{"n" in p ? String(p.n).padStart(2, "0") : "--"}</span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${oscuro ? "text-white/60" : "text-[#6b7280]"}`}>{p.l}</span>
        </div>
      ))}
    </div>
  );
}
