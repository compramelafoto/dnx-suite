"use client";

/** Campos controlados chicos para los inspectores de bloque — cada tecla llama a `onChange`,
 * así la preview central reacciona de inmediato. Sin estas piezas compartidas, cada inspector
 * reinventaría el mismo input+label. */

export function TextField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="fo-label">{label}</span>
      <input className="fo-input" value={value} onChange={(e) => onChange(e.target.value)} />
      {helper ? <p className="fo-helper">{helper}</p> : null}
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="fo-label">{label}</span>
      <textarea className="fo-input" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block space-y-1.5">
      <span className="fo-label">{label}</span>
      <select className="fo-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
