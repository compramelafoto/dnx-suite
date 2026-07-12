"use client";

export function AiImportPrompt({
  prompt,
  copied,
  onCopy,
}: {
  prompt: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Copiar prompt</h3>
      <p className="text-sm text-[var(--is-muted)]">
        Pegá este prompt en tu IA y adjuntá la imagen o el texto fuente.
      </p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4 text-xs leading-relaxed text-[var(--is-text)]">
        {prompt}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
      >
        {copied ? "Prompt copiado" : "Copiar prompt"}
      </button>
    </div>
  );
}
