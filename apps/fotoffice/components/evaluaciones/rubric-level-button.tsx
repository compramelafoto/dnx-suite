type RubricLevelButtonProps = {
  label: string;
  score: number;
  selected: boolean;
  shortcut?: number;
  onClick: () => void;
};

export function RubricLevelButton({ label, score, selected, shortcut, onClick }: RubricLevelButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex min-h-10 items-center justify-between gap-2 rounded-[var(--fo-radius-sm)] border px-3 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-[var(--fo-accent)] bg-[var(--fo-accent-muted)] text-[var(--fo-text)]"
          : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-text-secondary)] hover:border-[var(--fo-border-strong)] hover:bg-[var(--fo-surface-hover)]",
      ].join(" ")}
      aria-pressed={selected}
    >
      <span className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut ? (
          <kbd className="rounded border border-[var(--fo-border-strong)] bg-[var(--fo-kbd-bg)] px-1.5 py-0.5 text-[10px] text-[var(--fo-muted)]">
            {shortcut}
          </kbd>
        ) : null}
      </span>
      <span className="rounded-md bg-[var(--fo-surface-muted)] px-2 py-0.5 text-xs text-[var(--fo-text-secondary)]">{score}</span>
    </button>
  );
}
