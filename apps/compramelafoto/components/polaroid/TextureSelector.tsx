"use client";

import Select from "@/components/ui/Select";
import { TEXTURES } from "./textures";

export default function TextureSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#1a1a1a]">Textura del borde</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {TEXTURES.map((texture) => (
          <option key={texture.id} value={texture.id}>
            {texture.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
