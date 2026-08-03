import type { ReactNode } from "react";

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
};

const ACTIVE_CLASS =
  "bg-[var(--content-ui-accent,#525252)] text-white border-[var(--content-ui-accent,#525252)]";
const IDLE_CLASS = "bg-white text-gray-700 border-gray-300 hover:bg-gray-50";

export function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-medium border ${
        active ? ACTIVE_CLASS : IDLE_CLASS
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
