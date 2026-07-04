"use client";

import Button from "@/components/ui/Button";
import type { AdjustmentSettings } from "./export";

const sliders: Array<{
  key: keyof AdjustmentSettings;
  label: string;
  min: number;
  max: number;
  step?: number;
}> = [
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
  { key: "backgroundSmooth", label: "Suavizado borde", min: 0, max: 20 },
];

export default function AdjustmentsPanel({
  settings,
  onChange,
  onReset,
}: {
  settings: AdjustmentSettings;
  onChange: (next: AdjustmentSettings) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6b7280]">
          Ajustes rápidos para mejorar la foto antes de exportar.
        </p>
        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>
      <p className="text-xs text-[#6b7280]">
        No reemplaza un recorte perfecto, sirve para mejorar fondos ya claros.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sliders.map((slider) => (
          <div key={slider.key} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#1a1a1a]">{slider.label}</span>
              <span className="text-[#6b7280]">{settings[slider.key]}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const step = slider.step ?? 1;
                  const next = Math.max(slider.min, (settings[slider.key] as number) - step);
                  onChange({ ...settings, [slider.key]: next });
                }}
                className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
              >
                -
              </button>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={slider.step ?? 1}
                value={settings[slider.key] as number}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    [slider.key]: Number(e.target.value),
                  })
                }
                className="w-full"
              />
              <button
                type="button"
                onClick={() => {
                  const step = slider.step ?? 1;
                  const next = Math.min(slider.max, (settings[slider.key] as number) + step);
                  onChange({ ...settings, [slider.key]: next });
                }}
                className="h-8 w-8 rounded-md border border-[#e5e7eb] text-sm"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
