"use client";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  pending?: boolean;
  error?: string | null;
  applied?: {
    code: string;
    name: string;
    discountLabel: string;
  } | null;
  disabled?: boolean;
};

/** Campo para validar un código promocional antes de confirmar la inscripción. */
export function RegistrationPromoCodeField({
  id = "promoCode",
  value,
  onChange,
  onApply,
  onClear,
  pending,
  error,
  applied,
  disabled,
}: Props) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="ck-label text-ck-text-muted">
        Código de descuento
      </label>
      {applied ? (
        <div className="flex items-start justify-between gap-3 rounded-[var(--ck-radius-control)] border border-emerald-500/35 bg-emerald-500/10 px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-300">
              {applied.code} · {applied.discountLabel}
            </p>
            <p className="mt-0.5 truncate text-xs text-ck-text-secondary">{applied.name}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled || pending}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ck-text-secondary underline-offset-2 hover:text-ck-text hover:underline disabled:opacity-50"
          >
            Quitar
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            id={id}
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            disabled={disabled || pending}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApply();
              }
            }}
            placeholder="Ej. AMIGO2026"
            className="min-w-0 flex-1 rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-bg px-3 py-2.5 text-sm uppercase tracking-wide text-ck-text placeholder:normal-case placeholder:tracking-normal placeholder:text-ck-text-muted"
          />
          <button
            type="button"
            onClick={onApply}
            disabled={disabled || pending || value.trim().length < 2}
            className="shrink-0 rounded-[var(--ck-radius-control)] border border-ck-border-strong px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ck-text hover:border-ck-yellow hover:text-ck-yellow disabled:opacity-50"
          >
            {pending ? "…" : "Aplicar"}
          </button>
        </div>
      )}
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
