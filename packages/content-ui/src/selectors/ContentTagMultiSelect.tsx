import type { ContentOption } from "../types";

type ContentTagMultiSelectProps = {
  label: string;
  options: ContentOption[];
  value: number[];
  onToggle: (id: number) => void;
  disabled?: boolean;
};

const ACTIVE_CLASS =
  "bg-[var(--content-ui-accent,#525252)] text-white border-[var(--content-ui-accent,#525252)]";
const IDLE_CLASS = "bg-white text-gray-700 border-gray-300";

export function ContentTagMultiSelect({
  label,
  options,
  value,
  onToggle,
  disabled,
}: ContentTagMultiSelectProps) {
  return (
    <div>
      <label className="mb-2 block text-sm text-gray-600">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((tag) => {
          const active = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(tag.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium border disabled:opacity-50 ${
                active ? ACTIVE_CLASS : IDLE_CLASS
              }`}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
