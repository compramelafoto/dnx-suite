"use client";

import type { AdjustmentSettings } from "./procesar";

const DESLIZADORES: { key: keyof AdjustmentSettings; label: string; min: number; max: number }[] = [
  { key: "exposure", label: "Exposición", min: -100, max: 100 },
  { key: "contrast", label: "Contraste", min: -100, max: 100 },
  { key: "shadows", label: "Sombras", min: -100, max: 100 },
  { key: "blacks", label: "Negros", min: -100, max: 100 },
  { key: "lights", label: "Luces", min: -100, max: 100 },
  { key: "highlights", label: "Altas luces", min: -100, max: 100 },
  { key: "saturation", label: "Saturación", min: -100, max: 100 },
  { key: "temperature", label: "Temperatura", min: -100, max: 100 },
  { key: "tint", label: "Tinte", min: -100, max: 100 },
  { key: "sharpen", label: "Nitidez suave", min: 0, max: 100 },
  { key: "backgroundWhiten", label: "Fondo más blanco", min: 0, max: 100 },
  { key: "backgroundSmooth", label: "Suavizado del borde", min: 0, max: 20 },
];

/** Retoque rápido antes de imprimir: luz, color y fondo. */
export function Ajustes({
  settings,
  onChange,
  onReset,
}: {
  settings: AdjustmentSettings;
  onChange: (next: AdjustmentSettings) => void;
  onReset: () => void;
}) {
  const cambiar = (key: keyof AdjustmentSettings, valor: number, min: number, max: number) =>
    onChange({ ...settings, [key]: Math.min(max, Math.max(min, valor)) });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          Ajustes rápidos para mejorar la foto. «Fondo más blanco» sirve para fondos que ya son claros: no reemplaza un fondo de
          color.
        </p>
        <button type="button" className="fo-btn fo-btn-secondary shrink-0" onClick={onReset}>
          Volver a cero
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {DESLIZADORES.map((d) => (
          <div key={d.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{d.label}</span>
              <span className="text-xs text-[var(--fo-muted)]">{settings[d.key]}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="fo-icon-btn" onClick={() => cambiar(d.key, settings[d.key] - 1, d.min, d.max)} aria-label={`Menos ${d.label.toLowerCase()}`}>
                −
              </button>
              <input
                type="range"
                min={d.min}
                max={d.max}
                step={1}
                value={settings[d.key]}
                onChange={(e) => cambiar(d.key, Number(e.target.value), d.min, d.max)}
                className="w-full accent-[var(--fo-accent)]"
                aria-label={d.label}
              />
              <button type="button" className="fo-icon-btn" onClick={() => cambiar(d.key, settings[d.key] + 1, d.min, d.max)} aria-label={`Más ${d.label.toLowerCase()}`}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
