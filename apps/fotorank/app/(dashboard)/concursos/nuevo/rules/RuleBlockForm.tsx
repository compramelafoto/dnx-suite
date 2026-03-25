"use client";

import { FormField, inputBase, selectBase } from "../../../../components/ui/form";

export type RuleFieldOption = { value: string; label: string };

export type RuleFieldConfig = {
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
  /** "select" = dropdown, "multiselect" = checkboxes */
  type?: "text" | "multiline" | "select" | "multiselect";
  options?: RuleFieldOption[];
};

interface RuleBlockFormProps {
  title: string;
  description?: string;
  fields: RuleFieldConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

function renderField(
  field: RuleFieldConfig,
  value: string,
  onChange: (v: string) => void
) {
  if (field.type === "select" && field.options?.length) {
    return (
      <select
        id={field.key}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectBase}
      >
        <option value="">Seleccionar...</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "multiselect" && field.options?.length) {
    const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const toggle = (optValue: string) => {
      const next = selected.includes(optValue)
        ? selected.filter((v) => v !== optValue)
        : [...selected, optValue];
      onChange(next.join(", "));
    };
    return (
      <div className="flex flex-wrap gap-4">
        {field.options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#262626] bg-[#0a0a0a] px-4 py-3 transition-colors hover:border-[#333] has-[:checked]:border-gold has-[:checked]:bg-gold/10"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
              className="h-4 w-4 rounded border-[#262626] bg-[#0a0a0a] text-gold focus:ring-gold"
            />
            <span className="text-sm text-fr-primary">{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.rows && field.rows > 1) {
    return (
      <textarea
        id={field.key}
        rows={field.rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`${inputBase} min-h-[4rem] resize-y`}
      />
    );
  }

  return (
    <input
      id={field.key}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={inputBase}
    />
  );
}

export function RuleBlockForm({
  title,
  description,
  fields,
  values,
  onChange,
}: RuleBlockFormProps) {
  return (
    <div className="fr-form-section space-y-6">
      <div className="mb-6">
        <h4 className="font-sans text-base font-semibold text-fr-primary">{title}</h4>
        {description && (
          <p className="mt-2 text-sm text-fr-muted leading-relaxed">{description}</p>
        )}
      </div>
      <div className="space-y-6">
        {fields.map((field) => (
          <FormField
            key={field.key}
            id={field.key}
            label={field.label}
            hint={field.hint}
          >
            {renderField(field, values[field.key] ?? "", (v) => onChange(field.key, v))}
          </FormField>
        ))}
      </div>
    </div>
  );
}
