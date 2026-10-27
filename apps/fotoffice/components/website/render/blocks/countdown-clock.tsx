"use client";

import { useSyncExternalStore } from "react";
import { countdownParts } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";

/** Un tic por segundo, compartido por todos los relojes de la página. */
function subscribe(onTick: () => void): () => void {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}
const nowSeconds = () => Math.floor(Date.now() / 1000);
/** En el servidor y en la hidratación no hay «ahora»: se dibujan guiones y recién después el
 * navegador pone los números. Así el HTML inicial es siempre el mismo (sin desajuste). */
const serverSnapshot = () => null;

export function CountdownClock({ targetMs, doneText }: { targetMs: number; doneText: string }) {
  const now = useSyncExternalStore(subscribe, nowSeconds, serverSnapshot);
  const parts = now === null ? null : countdownParts(targetMs, now * 1000);

  if (parts?.done) {
    return (
      <p className="text-2xl font-semibold" style={levelStyle("heading", { color: true })}>
        {doneText}
      </p>
    );
  }

  const cells: [string, number | undefined][] = [
    ["días", parts?.days],
    ["horas", parts?.hours],
    ["minutos", parts?.minutes],
    ["segundos", parts?.seconds],
  ];
  return (
    <div className="flex flex-wrap justify-center gap-3" role="timer" aria-live="off">
      {cells.map(([label, value]) => (
        <div key={label} className="min-w-[4.5rem] rounded-2xl px-3 py-4" style={{ backgroundColor: "color-mix(in srgb, var(--wsite-primary) 10%, transparent)" }}>
          <div className="text-3xl font-bold tabular-nums" style={{ color: "var(--wsite-primary)" }}>
            {value === undefined ? "--" : String(value).padStart(2, "0")}
          </div>
          <div className="text-xs uppercase tracking-wide" style={{ ...levelStyle("body", { color: true }), fontSize: "0.75rem", opacity: 0.7 }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
