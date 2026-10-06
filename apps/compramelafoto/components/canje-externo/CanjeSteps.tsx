"use client";

/** Indicador de los tres momentos del canje. El paso 2 es opcional y se dice. */

export type CanjeStepKey = "combo" | "extras" | "confirmar";

const PASOS: Array<{ key: CanjeStepKey; label: string }> = [
  { key: "combo", label: "Tu combo" },
  { key: "extras", label: "Más fotos (opcional)" },
  { key: "confirmar", label: "Confirmar" },
];

export default function CanjeSteps({
  current,
  labels,
}: {
  current: CanjeStepKey;
  /** Nombres propios de cada paso (el canje de preventa dice "Tu pack" en vez de "Tu combo"). */
  labels?: Partial<Record<CanjeStepKey, string>>;
}) {
  const pasos = PASOS.map((p) => ({ ...p, label: labels?.[p.key] ?? p.label }));
  const idx = pasos.findIndex((p) => p.key === current);
  return (
    <ol className="m-0 flex list-none items-center gap-2 p-0 text-xs sm:text-sm" aria-label="Pasos del canje">
      {pasos.map((p, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={p.key} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-[#2f7d5b] text-white"
                  : active
                    ? "bg-[#c27b3d] text-white"
                    : "bg-[#ece7e1] text-[#8a8178]"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "font-semibold text-[#1f2328]" : "text-[#8a8178]"}>{p.label}</span>
            {i < pasos.length - 1 ? <span className="mx-0.5 h-px w-3 bg-[#d8d0c7] sm:w-6" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
