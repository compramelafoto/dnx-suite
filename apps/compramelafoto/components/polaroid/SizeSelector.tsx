"use client";

import Select from "@/components/ui/Select";
import { POLAROID_PRESETS, type PolaroidPreset } from "./presets";

export default function SizeSelector({
  value,
  onChange,
}: {
  value: PolaroidPreset;
  onChange: (next: PolaroidPreset) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#1a1a1a]">Tamaño de polaroid</label>
      <Select
        value={value.id}
        onChange={(e) => {
          const next = POLAROID_PRESETS.find((preset) => preset.id === e.target.value);
          if (next) onChange(next);
        }}
      >
        {POLAROID_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
