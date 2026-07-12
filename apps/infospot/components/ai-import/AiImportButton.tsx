"use client";

export function AiImportButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium hover:border-[var(--is-accent)] hover:text-[var(--is-accent)] ${className}`}
    >
      Importar con IA
    </button>
  );
}
