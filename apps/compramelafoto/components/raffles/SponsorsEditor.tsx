"use client";

import { Plus, Trash2 } from "lucide-react";
import { dsInputClassName } from "@/components/ui/form-control-classes";
import ImageUpload from "./ImageUpload";

export type SponsorDraft = { name: string | null; logoUrl: string | null; url: string | null };

const campo = `${dsInputClassName} !py-2.5 !text-sm`;

/**
 * Los sponsors del sorteo (además de los que donan un premio): su logo desfila en la página
 * pública y en el panel. Un sponsor sin logo no se guarda.
 */
export default function SponsorsEditor({
  value,
  onChange,
}: {
  value: SponsorDraft[];
  onChange: (v: SponsorDraft[]) => void;
}) {
  const set = (i: number, patch: Partial<SponsorDraft>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {value.map((s, i) => (
          <div key={i} className="relative space-y-3 rounded-2xl border border-[#111827]/10 bg-white p-4">
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute right-3 top-3 rounded-full p-1.5 text-[#9ca3af] hover:bg-red-50 hover:text-[#b91c1c]"
              aria-label="Quitar sponsor"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <ImageUpload kind="logo" label="Logo" value={s.logoUrl} onChange={(url) => set(i, { logoUrl: url })} />
            <input className={campo} placeholder="Nombre" value={s.name ?? ""} onChange={(e) => set(i, { name: e.target.value })} />
            <input className={campo} placeholder="Sitio o Instagram (opcional)" value={s.url ?? ""} onChange={(e) => set(i, { url: e.target.value })} />
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, { name: "", logoUrl: null, url: "" }])}
          className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#111827]/15 text-sm font-medium text-[#6b7280] transition hover:border-[#c27b3d]/60 hover:text-[#c27b3d]"
        >
          <Plus className="h-5 w-5" />
          Agregar sponsor
        </button>
      </div>
      {value.some((s) => !s.logoUrl) && (
        <p className="text-xs text-[#b45309]">Los sponsors sin logo no se guardan.</p>
      )}
    </div>
  );
}
