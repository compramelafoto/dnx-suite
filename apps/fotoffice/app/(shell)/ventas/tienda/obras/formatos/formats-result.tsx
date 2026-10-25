import type { FormatsActionResult } from "./actions";

export function FormatsResult({ resultado }: { resultado: FormatsActionResult | null }) {
  if (!resultado) return null;
  return resultado.ok ? (
    <p className="text-sm text-[var(--fo-success)]">{resultado.message ?? "Listo."}</p>
  ) : (
    <p className="text-sm text-[var(--fo-danger)]" role="alert">
      {resultado.error}
    </p>
  );
}
