"use client";

export function AiImportCsvInput({
  value,
  onChange,
  example,
  parseError,
}: {
  value: string;
  onChange: (value: string) => void;
  example: string;
  parseError: string | null;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Pegar resultado</h3>
      <p className="text-sm text-[var(--is-muted)]">
        Pegá solo el CSV (una fila). Podés ver un ejemplo abajo.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={12}
        className="w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 font-mono text-xs leading-relaxed outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20"
        placeholder="Pegá aquí el CSV…"
        spellCheck={false}
      />
      {parseError ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {parseError}
        </p>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-[var(--is-accent)]">
          Ver ejemplo de CSV
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-surface)] p-3 text-[11px]">
          {example}
        </pre>
      </details>
    </div>
  );
}
