import type { ContestActionResult } from "./actions";

/** Mensaje de éxito o error de una acción de la pantalla del concurso. */
export function ContestResult({ resultado }: { resultado: ContestActionResult | null }) {
  if (!resultado) return null;
  return resultado.ok ? (
    <p className="text-sm text-[var(--fo-success)]" role="status">
      {resultado.message ?? "Listo."}
    </p>
  ) : (
    <p className="text-sm text-[var(--fo-danger)]" role="alert">
      {resultado.error}
    </p>
  );
}
