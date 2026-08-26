"use client";

import { ImageUploadField } from "@/components/image-upload-field";
import { SelectField, TextField, ToggleField } from "@/components/website/inspector/inspector-fields";
import {
  ANIMATION_PRESETS,
  BUTTON_PRESETS,
  HEADER_PRESETS,
  TYPOGRAPHY_PRESETS,
  type WebsiteDesignPresets,
} from "@/lib/website/design-presets";
import { WEBSITE_DEFAULT_COLORS, type WebsiteColors } from "@/lib/website/branding-defaults";

const COLOR_FIELDS: { key: keyof WebsiteColors; label: string }[] = [
  { key: "primaryColor", label: "Color principal" },
  { key: "secondaryColor", label: "Color secundario" },
  { key: "backgroundColor", label: "Fondo" },
  { key: "textColor", label: "Texto" },
  { key: "accentColor", label: "Acento" },
];

/**
 * Panel "Diseño". Todo lo de acá persiste de verdad ahora: colores/logo/favicon en
 * `FotofficeWorkspaceBranding` (misma fuente de verdad que Configuración), header/tipografía/
 * botones/animación/tamaño de logo en `FotofficeWorkspaceWebsite.designPresetsJson` — y se
 * congela en la Version al publicar (ver informe de esta etapa).
 */
export function DesignPanel({
  colors,
  logoUrl,
  faviconUrl,
  presets,
  canEdit,
  onColorsChange,
  onLogoChange,
  onFaviconChange,
  onPresetsChange,
}: {
  colors: WebsiteColors;
  logoUrl: string | null;
  faviconUrl: string | null;
  presets: WebsiteDesignPresets;
  canEdit: boolean;
  onColorsChange: (colors: WebsiteColors) => void;
  onLogoChange: (url: string | null) => void;
  onFaviconChange: (url: string | null) => void;
  onPresetsChange: (presets: WebsiteDesignPresets) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-[var(--fo-border)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Diseño</p>
      </div>
      <fieldset disabled={!canEdit} className="flex-1 overflow-y-auto p-4 space-y-6 border-0">
        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Logo</p>
          <ImageUploadField name="_logo" presetKey="workspaceLogo" label="" initialUrl={logoUrl} onUploaded={onLogoChange} />
          <label className="block space-y-1.5">
            <span className="fo-label text-xs">Tamaño en el header ({presets.logoSizePx}px)</span>
            <input
              type="range"
              min={24}
              max={96}
              step={4}
              value={presets.logoSizePx}
              onChange={(e) => onPresetsChange({ ...presets, logoSizePx: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Favicon</p>
          <ImageUploadField name="_favicon" presetKey="favicon" label="" description="El ícono que se ve en la pestaña del navegador." initialUrl={faviconUrl} onUploaded={onFaviconChange} />
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Colores</p>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="block space-y-1">
                <span className="fo-label text-xs">{label}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colors[key] || WEBSITE_DEFAULT_COLORS[key]}
                    onChange={(e) => onColorsChange({ ...colors, [key]: e.target.value })}
                    className="h-8 w-10 shrink-0 rounded border border-[var(--fo-border)] cursor-pointer"
                  />
                  <input
                    value={colors[key] || ""}
                    onChange={(e) => onColorsChange({ ...colors, [key]: e.target.value })}
                    className="fo-input font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Encabezado / Menú</p>
          <SelectField
            label="Estilo"
            value={presets.headerPreset}
            onChange={(v) => onPresetsChange({ ...presets, headerPreset: v as WebsiteDesignPresets["headerPreset"] })}
            options={HEADER_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          />
          <ToggleField
            label='Mostrar botón "Iniciar sesión"'
            checked={presets.showLoginButton}
            onChange={(v) => onPresetsChange({ ...presets, showLoginButton: v })}
          />
          {presets.showLoginButton ? (
            <TextField
              label="Texto del botón"
              value={presets.loginButtonLabel}
              onChange={(v) => onPresetsChange({ ...presets, loginButtonLabel: v })}
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Tipografía</p>
          <SelectField
            label="Estilo"
            value={presets.typographyPreset}
            onChange={(v) => onPresetsChange({ ...presets, typographyPreset: v as WebsiteDesignPresets["typographyPreset"] })}
            options={TYPOGRAPHY_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          />
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Botones</p>
          <SelectField
            label="Estilo"
            value={presets.buttonPreset}
            onChange={(v) => onPresetsChange({ ...presets, buttonPreset: v as WebsiteDesignPresets["buttonPreset"] })}
            options={BUTTON_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          />
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Animaciones</p>
          <SelectField
            label="Estilo"
            value={presets.animationPreset}
            onChange={(v) => onPresetsChange({ ...presets, animationPreset: v as WebsiteDesignPresets["animationPreset"] })}
            options={ANIMATION_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
          />
        </section>
      </fieldset>
    </div>
  );
}
