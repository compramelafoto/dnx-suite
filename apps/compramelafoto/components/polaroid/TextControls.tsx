"use client";

import Select from "@/components/ui/Select";
import type { PolaroidText } from "./export";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { getPolaroidFontFamily, normalizePolaroidFontValue, POLAROID_FONTS } from "./fonts";

export default function TextControls({
  value,
  onChange,
  onDelete,
}: {
  value: PolaroidText;
  onChange: (next: PolaroidText) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-[#1a1a1a]">Texto</label>
        {onDelete && (
          <Button variant="secondary" type="button" onClick={onDelete}>
            Eliminar
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#6b7280] mb-1">Color</label>
          <Input
            type="color"
            value={value.color}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs text-[#6b7280] mb-1">Tamaño</label>
          <Input
            type="number"
            min="10"
            max="120"
            value={value.fontSize}
            onChange={(e) => onChange({ ...value, fontSize: Number(e.target.value) || 24 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant={value.bold ? "primary" : "secondary"}
          type="button"
          onClick={() => onChange({ ...value, bold: !value.bold })}
        >
          Negrita
        </Button>
        <Button
          variant={value.italic ? "primary" : "secondary"}
          type="button"
          onClick={() => onChange({ ...value, italic: !value.italic })}
        >
          Cursiva
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#6b7280] mb-1">Fuente</label>
          <Select
            value={normalizePolaroidFontValue(value.fontFamily)}
            onChange={(e) => onChange({ ...value, fontFamily: e.target.value })}
            style={{ fontFamily: getPolaroidFontFamily(value.fontFamily) }}
          >
            {POLAROID_FONTS.map((font) => (
              <option
                key={font.value}
                value={font.value}
                style={{ fontFamily: getPolaroidFontFamily(font.value) }}
              >
                {font.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-xs text-[#6b7280] mb-1">Rotación</label>
          <input
            type="range"
            min="-45"
            max="45"
            value={value.rotation}
            onChange={(e) => onChange({ ...value, rotation: Number(e.target.value) || 0 })}
            className="w-full"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[#6b7280] mb-1">Alineación</label>
        <Select
          value={value.align}
          onChange={(e) =>
            onChange({ ...value, align: e.target.value as CanvasTextAlign })
          }
        >
          <option value="left">Izquierda</option>
          <option value="center">Centro</option>
          <option value="right">Derecha</option>
        </Select>
      </div>
      <p className="text-xs text-[#6b7280]">
        Podés arrastrar el texto directamente sobre la polaroid.
      </p>
    </div>
  );
}
