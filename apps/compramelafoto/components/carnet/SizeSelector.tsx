"use client";

import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { calculateGrid, cmToPx } from "./math";

export default function SizeSelector({
  widthCm,
  heightCm,
  sheetWidthCm,
  sheetHeightCm,
  marginCm,
  gapCm,
  dpi,
  onChange,
}: {
  widthCm: number;
  heightCm: number;
  sheetWidthCm: number;
  sheetHeightCm: number;
  marginCm: number;
  gapCm: number;
  dpi: number;
  onChange: (next: { widthCm: number; heightCm: number }) => void;
}) {
  const presets = [
    { label: "4 × 4 cm", width: 4, height: 4 },
    { label: "3.5 × 4.5 cm", width: 3.5, height: 4.5 },
    { label: "3 × 3 cm", width: 3, height: 3 },
    { label: "5 × 5 cm", width: 5, height: 5 },
    { label: "3 × 4 cm", width: 3, height: 4 },
    { label: "5 × 7 cm", width: 5, height: 7 },
    { label: "2.4 × 3.2 cm", width: 2.4, height: 3.2 },
    { label: "2.6 × 3.2 cm", width: 2.6, height: 3.2 },
    { label: "2.5 × 3.5 cm", width: 2.5, height: 3.5 },
  ];
  const selectedKey = `${widthCm}x${heightCm}`;
  const sheetWidthPx = cmToPx(sheetWidthCm, dpi);
  const sheetHeightPx = cmToPx(sheetHeightCm, dpi);
  const marginPx = cmToPx(marginCm, dpi);
  const gapPx = cmToPx(gapCm, dpi);
  const getCapacity = (width: number, height: number) =>
    calculateGrid({
      sheetWidthPx,
      sheetHeightPx,
      photoWidthPx: cmToPx(width, dpi),
      photoHeightPx: cmToPx(height, dpi),
      marginPx,
      gapPx,
      maxTotal: 6,
    }).total;
  const selectedPreset = presets.find((preset) => `${preset.width}x${preset.height}` === selectedKey);
  const selectedCapacity = selectedPreset ? getCapacity(selectedPreset.width, selectedPreset.height) : null;
  const selectedValue = presets.some((preset) => `${preset.width}x${preset.height}` === selectedKey)
    ? selectedKey
    : "custom";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Medidas más usadas (cm)</label>
          <Select
            value={selectedValue}
            onChange={(e) => {
              const value = e.target.value;
              const preset = presets.find((item) => `${item.width}x${item.height}` === value);
              if (preset) {
                onChange({ widthCm: preset.width, heightCm: preset.height });
              }
            }}
          >
            <option value="custom">Personalizada</option>
            {presets.map((preset) => (
              <option key={`${preset.width}x${preset.height}`} value={`${preset.width}x${preset.height}`}>
                {preset.label} ({getCapacity(preset.width, preset.height)} fotos)
              </option>
            ))}
          </Select>
          {selectedCapacity && (
            <p className="text-xs text-[#6b7280] mt-2">
              Entran {selectedCapacity} fotos en la plancha {sheetWidthCm} × {sheetHeightCm} cm.
            </p>
          )}
        </div>
        <div className="space-y-4">
          <div className="text-sm font-medium text-[#1a1a1a]">Medidas personalizadas (cm)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Ancho (cm)</label>
          <Input
            type="number"
            min="2"
            step="0.1"
            value={widthCm}
            onChange={(e) => onChange({ widthCm: Number(e.target.value) || 0, heightCm })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Alto (cm)</label>
          <Input
            type="number"
            min="2"
            step="0.1"
            value={heightCm}
            onChange={(e) => onChange({ widthCm, heightCm: Number(e.target.value) || 0 })}
          />
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
