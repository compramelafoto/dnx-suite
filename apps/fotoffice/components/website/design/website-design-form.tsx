"use client";

import { useActionState } from "react";
import { saveWebsiteBrandingColorsAction, type WebsiteBrandingColorsState } from "@/app/actions/website";
import { WEBSITE_DEFAULT_COLORS } from "@/lib/website/branding-defaults";

const initial: WebsiteBrandingColorsState = { error: null };

const COLOR_FIELDS = [
  { name: "primaryColor", label: "Color principal" },
  { name: "secondaryColor", label: "Color secundario" },
  { name: "backgroundColor", label: "Fondo" },
  { name: "textColor", label: "Texto" },
  { name: "accentColor", label: "Acento" },
] as const;

export function WebsiteDesignForm({
  initialColors,
  canEdit,
}: {
  initialColors: Record<(typeof COLOR_FIELDS)[number]["name"], string | null>;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(saveWebsiteBrandingColorsAction, initial);

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={!canEdit} className="fo-card space-y-5 border-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--fo-text)]">Colores</h2>
          <p className="fo-helper mt-1">
            Estos colores son los mismos que usa tu Workspace en Configuración — cambiarlos acá
            actualiza el sitio y el resto de la plataforma.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {COLOR_FIELDS.map((field) => (
            <ColorField
              key={field.name}
              label={field.label}
              name={field.name}
              defaultValue={initialColors[field.name] || WEBSITE_DEFAULT_COLORS[field.name]}
            />
          ))}
        </div>
        {state.error ? <p className="text-sm text-[var(--fo-danger)]">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-[var(--fo-success)]">Guardado.</p> : null}
        {canEdit ? (
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
            {pending ? "Guardando…" : "Guardar diseño"}
          </button>
        ) : null}
      </fieldset>

      <div className="fo-card space-y-3 opacity-60">
        <h2 className="text-sm font-semibold text-[var(--fo-text)]">Próximamente</h2>
        <ul className="text-sm text-[var(--fo-muted)] space-y-1.5 list-disc list-inside">
          <li>Tipografía del sitio</li>
          <li>Estilo de botones</li>
          <li>Favicon</li>
        </ul>
      </div>
    </form>
  );
}

function ColorField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block space-y-2">
      <span className="fo-label">{label}</span>
      <div className="flex items-center gap-3">
        <input type="color" name={`${name}Picker`} defaultValue={defaultValue} className="h-10 w-14 rounded-lg border border-[var(--fo-border)] cursor-pointer" onChange={(e) => {
          const hidden = e.currentTarget.form?.elements.namedItem(name) as HTMLInputElement | null;
          if (hidden) hidden.value = e.currentTarget.value;
        }} />
        <input name={name} defaultValue={defaultValue} className="fo-input font-mono text-sm" maxLength={7} />
      </div>
    </label>
  );
}
