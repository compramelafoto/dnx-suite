import type { CountdownBlockConfig } from "@/lib/website/blocks";
import { countdownTargetMs } from "@/lib/website/blocks-extra";
import { levelStyle } from "@/lib/website/typography";
import { CountdownClock } from "./countdown-clock";

/** Cuenta regresiva a una fecha y hora argentinas. El reloj que corre es un componente de
 * cliente chico; esta parte (título) se dibuja en el servidor. Sin fecha válida, en el sitio no
 * se dibuja; en la vista previa del builder avisa que falta. */
export function CountdownBlockView({ config, data }: { config: CountdownBlockConfig; blockId?: string; data?: unknown }) {
  const target = countdownTargetMs(config.date, config.time);
  if (target === null && data !== undefined) return null;

  return (
    <section className="px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        {config.title.trim() ? (
          <h2 style={{ ...levelStyle("heading", { color: true }), letterSpacing: "var(--wsite-letter-spacing)" }}>{config.title}</h2>
        ) : null}
        {target === null ? (
          <p className="opacity-60" style={levelStyle("body", { color: true })}>
            Elegí la fecha y la hora en el panel para que corra la cuenta regresiva.
          </p>
        ) : (
          <CountdownClock targetMs={target} doneText={config.doneText} />
        )}
      </div>
    </section>
  );
}
