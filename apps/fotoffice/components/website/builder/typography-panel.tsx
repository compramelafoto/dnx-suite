"use client";

import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { SelectField, ToggleField } from "@/components/website/inspector/inspector-fields";
import type { WebsiteColors } from "@/lib/website/branding-defaults";
import { TYPOGRAPHY_PRESETS, resolvedTypography, type WebsiteDesignPresets } from "@/lib/website/design-presets";
import {
  FONT_CATEGORY_LABELS,
  FONT_OPTIONS,
  PALETTE_COLORS,
  SIZE_STEPS,
  TYPOGRAPHY_LEVELS,
  WEIGHT_LABELS,
  getFont,
  nearestWeight,
  type FontCategory,
  type LevelColor,
  type TypographyLevel,
  type TypographyLevelId,
  type TypographyLevelOverride,
} from "@/lib/website/typography";

/** Niveles que siempre van sobre una foto o un botón de color: su color no se elige. */
const SIN_COLOR: Record<TypographyLevelId, string | null> = {
  title: "Va sobre la foto de la portada: siempre en blanco, para que se lea.",
  subtitle: "Va sobre la foto de la portada: siempre en blanco, para que se lea.",
  button: "El color de los botones sale de Colores (Acento) y del estilo de botón.",
  heading: null,
  body: null,
  menu: null,
};

const PALETA_A_COLOR: Record<(typeof PALETTE_COLORS)[number]["id"], keyof WebsiteColors> = {
  text: "textColor",
  primary: "primaryColor",
  secondary: "secondaryColor",
  accent: "accentColor",
};

/**
 * Sección "Tipografía" del panel Diseño: un estilo de partida y, encima, cada nivel por separado.
 * Lo que se cambia por nivel se guarda aparte (`typographyLevels`); elegir otro estilo de partida
 * lo borra y arranca de esa base (ver `typography.ts`).
 */
export function TypographyPanel({
  presets,
  colors,
  onPresetsChange,
}: {
  presets: WebsiteDesignPresets;
  colors: WebsiteColors;
  onPresetsChange: (presets: WebsiteDesignPresets) => void;
}) {
  const [abierto, setAbierto] = useState<TypographyLevelId | null>(null);
  const resueltos = resolvedTypography(presets);
  const hayCambios = Object.keys(presets.typographyLevels).length > 0;

  const cambiarNivel = (id: TypographyLevelId, cambio: TypographyLevelOverride | null) => {
    const siguiente = { ...presets.typographyLevels };
    if (cambio === null) delete siguiente[id];
    else siguiente[id] = { ...siguiente[id], ...cambio };
    onPresetsChange({ ...presets, typographyLevels: siguiente });
  };

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold text-[var(--fo-text)]">Tipografía</p>
      <SelectField
        label="Estilo de partida"
        value={presets.typographyPreset}
        onChange={(v) => {
          if (hayCambios && !window.confirm("Elegir otro estilo de partida borra lo que cambiaste en cada nivel. ¿Seguimos?")) return;
          onPresetsChange({ ...presets, typographyPreset: v as WebsiteDesignPresets["typographyPreset"], typographyLevels: {} });
        }}
        options={TYPOGRAPHY_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
      />
      <p className="fo-helper">Elegí un estilo y ajustá cada nivel por separado.</p>

      <ul className="space-y-1.5">
        {TYPOGRAPHY_LEVELS.map((nivel) => (
          <LevelRow
            key={nivel.id}
            id={nivel.id}
            label={nivel.label}
            description={nivel.description}
            sample={nivel.sample}
            value={resueltos[nivel.id]}
            colors={colors}
            edited={Boolean(presets.typographyLevels[nivel.id])}
            open={abierto === nivel.id}
            onToggle={() => setAbierto((actual) => (actual === nivel.id ? null : nivel.id))}
            onChange={(cambio) => cambiarNivel(nivel.id, cambio)}
            onReset={() => cambiarNivel(nivel.id, null)}
          />
        ))}
      </ul>
    </section>
  );
}

function LevelRow({
  id,
  label,
  description,
  sample,
  value,
  colors,
  edited,
  open,
  onToggle,
  onChange,
  onReset,
}: {
  id: TypographyLevelId;
  label: string;
  description: string;
  sample: string;
  value: TypographyLevel;
  colors: WebsiteColors;
  edited: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: (cambio: TypographyLevelOverride) => void;
  onReset: () => void;
}) {
  const font = getFont(value.font);
  const notaColor = SIN_COLOR[id];
  const colorMuestra = notaColor ? "var(--fo-text)" : colorDeMuestra(value.color, colors);
  const panelId = `tipografia-${id}`;

  return (
    <li className="rounded-lg border border-[var(--fo-border)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--fo-muted)]">
            {label}
            {edited ? <span className="rounded-full bg-[var(--fo-accent-soft)] px-1.5 text-[10px] text-[var(--fo-accent)]">editado</span> : null}
          </span>
          <span
            className="block truncate text-[15px]"
            style={{
              fontFamily: font.stack,
              fontWeight: value.weight,
              textTransform: value.uppercase ? "uppercase" : "none",
              color: colorMuestra,
            }}
          >
            {sample}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--fo-muted)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open ? (
        <div id={panelId} className="space-y-3 border-t border-[var(--fo-border)] px-3 py-3">
          <p className="fo-helper">{description}</p>

          <label className="block space-y-1.5">
            <span className="fo-label">Letra</span>
            <select
              className="fo-input"
              value={value.font}
              onChange={(e) => {
                const nueva = getFont(e.target.value);
                // Si la letra nueva no trae el grosor actual, se pasa al más cercano que sí trae.
                onChange({ font: nueva.id, weight: nearestWeight(nueva, value.weight) });
              }}
            >
              {(Object.keys(FONT_CATEGORY_LABELS) as FontCategory[]).map((categoria) => (
                <optgroup key={categoria} label={FONT_CATEGORY_LABELS[categoria]}>
                  {FONT_OPTIONS.filter((f) => f.category === categoria).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <span className="fo-label">Tamaño</span>
            <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={`Tamaño de ${label}`}>
              {SIZE_STEPS.map((paso) => (
                <button
                  key={paso.id}
                  type="button"
                  role="radio"
                  aria-checked={value.size === paso.id}
                  onClick={() => onChange({ size: paso.id })}
                  className={[
                    "rounded-md border px-1 py-1.5 text-[11px]",
                    value.size === paso.id
                      ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] text-[var(--fo-text)]"
                      : "border-[var(--fo-border)] text-[var(--fo-muted)]",
                  ].join(" ")}
                >
                  {paso.label}
                </button>
              ))}
            </div>
          </div>

          <SelectField
            label="Grosor"
            value={String(value.weight)}
            onChange={(v) => onChange({ weight: Number(v) })}
            options={font.weights.map((w) => ({ value: String(w), label: WEIGHT_LABELS[w] ?? String(w) }))}
          />

          {notaColor ? (
            <p className="fo-helper">{notaColor}</p>
          ) : (
            <ColorPicker value={value.color} colors={colors} onChange={(color) => onChange({ color })} />
          )}

          <ToggleField label="Todo en mayúsculas" checked={value.uppercase} onChange={(v) => onChange({ uppercase: v })} />

          {edited ? (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" /> Volver al estilo de partida
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function colorDeMuestra(color: LevelColor, colors: WebsiteColors): string {
  const paleta = PALETTE_COLORS.find((c) => c.id === color);
  return paleta ? colors[PALETA_A_COLOR[paleta.id]] : color;
}

function ColorPicker({
  value,
  colors,
  onChange,
}: {
  value: LevelColor;
  colors: WebsiteColors;
  onChange: (color: LevelColor) => void;
}) {
  const esPropio = value.startsWith("#");
  return (
    <div className="space-y-1.5">
      <span className="fo-label">Color</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {PALETTE_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={value === c.id}
            title={c.label}
            onClick={() => onChange(c.id)}
            className={[
              "flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]",
              value === c.id ? "border-[var(--fo-accent)] text-[var(--fo-text)]" : "border-[var(--fo-border)] text-[var(--fo-muted)]",
            ].join(" ")}
          >
            <span className="h-3 w-3 rounded-full border border-[var(--fo-border)]" style={{ backgroundColor: colors[PALETA_A_COLOR[c.id]] }} />
            {c.label}
          </button>
        ))}
        <label
          className={[
            "flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[11px]",
            esPropio ? "border-[var(--fo-accent)] text-[var(--fo-text)]" : "border-[var(--fo-border)] text-[var(--fo-muted)]",
          ].join(" ")}
        >
          <input
            type="color"
            className="h-3 w-3 cursor-pointer appearance-none rounded-full border-0 p-0"
            value={esPropio ? value : "#333333"}
            onChange={(e) => onChange(e.target.value)}
            aria-label="Color propio"
          />
          Otro
        </label>
      </div>
    </div>
  );
}
