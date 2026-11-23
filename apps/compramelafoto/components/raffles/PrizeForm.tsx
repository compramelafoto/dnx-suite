"use client";

import { dsInputClassName, dsTextareaClassName } from "@/components/ui/form-control-classes";
import ImageUpload from "./ImageUpload";

export type PrizeDraft = {
  title: string;
  description?: string | null;
  sponsorName?: string | null;
  sponsorLogoUrl?: string | null;
  sponsorUrl?: string | null;
  imageUrl?: string | null;
  deliveryInstructions?: string | null;
  estimatedValueArs?: number | null;
};

export const emptyPrize: PrizeDraft = { title: "" };

const campo = `${dsInputClassName} !py-2.5 !text-sm`;
const area = `${dsTextareaClassName} !py-2.5 !text-sm`;

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[#1a1a1a]">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[#6b7280]">{hint}</span>}
    </label>
  );
}

/** Los campos de un premio: foto, textos y quién lo da (con su logo). */
export default function PrizeForm({
  value,
  onChange,
  titleLocked = false,
}: {
  value: PrizeDraft;
  onChange: (v: PrizeDraft) => void;
  /** Después de anunciar el nombre no se cambia: es lo que figura en la verificación. */
  titleLocked?: boolean;
}) {
  const set = <K extends keyof PrizeDraft>(k: K, v: PrizeDraft[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,14rem)_1fr]">
      <ImageUpload
        kind="premio"
        label="Foto del premio"
        hint="Se ve en la página del sorteo y en el panel de los fotógrafos."
        value={value.imageUrl}
        onChange={(url) => set("imageUrl", url)}
      />
      <div className="space-y-4">
        <Campo label="Premio" hint={titleLocked ? "El nombre queda fijo después de anunciar." : undefined}>
          <input
            className={campo}
            value={value.title}
            disabled={titleLocked}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ej.: Mochila para cámara"
            required
          />
        </Campo>
        <Campo label="Descripción (opcional)">
          <textarea className={area} rows={2} value={value.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Cómo se entrega" hint="Va en el correo al ganador.">
            <input
              className={campo}
              value={value.deliveryInstructions ?? ""}
              onChange={(e) => set("deliveryInstructions", e.target.value)}
              placeholder="Ej.: Lo retirás en el local"
            />
          </Campo>
          <Campo label="Valor estimado en pesos (opcional)">
            <input
              className={campo}
              type="number"
              min={0}
              value={value.estimatedValueArs ?? ""}
              onChange={(e) => set("estimatedValueArs", e.target.value ? Number(e.target.value) : null)}
            />
          </Campo>
        </div>
        <fieldset className="rounded-2xl border border-[#111827]/10 bg-[#fafafa] p-4">
          <legend className="px-1 text-sm font-semibold text-[#111827]">Quién lo da (opcional)</legend>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <ImageUpload
              kind="logo"
              label="Logo"
              hint="Mejor PNG con fondo transparente."
              value={value.sponsorLogoUrl}
              onChange={(url) => set("sponsorLogoUrl", url)}
            />
            <div className="space-y-4">
              <Campo label="Nombre del sponsor">
                <input className={campo} value={value.sponsorName ?? ""} onChange={(e) => set("sponsorName", e.target.value)} placeholder="Ej.: Casa de fotografía" />
              </Campo>
              <Campo label="Sitio o Instagram (opcional)">
                <input className={campo} value={value.sponsorUrl ?? ""} onChange={(e) => set("sponsorUrl", e.target.value)} placeholder="instagram.com/marca" />
              </Campo>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
