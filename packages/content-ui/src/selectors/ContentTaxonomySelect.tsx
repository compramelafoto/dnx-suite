import type { ContentOption } from "../types";

type ContentTaxonomySelectProps = {
  label: string;
  emptyLabel: string;
  value: string;
  options: ContentOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function ContentTaxonomySelect({
  label,
  emptyLabel,
  value,
  options,
  onChange,
  disabled,
}: ContentTaxonomySelectProps) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-600">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
