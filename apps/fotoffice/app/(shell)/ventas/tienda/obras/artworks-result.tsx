import type { ArtworksActionResult } from "./actions";

/** Mensaje de éxito o error de una acción de la pantalla de obras. */
export function ArtworksResult({ resultado }: { resultado: ArtworksActionResult | null }) {
  if (!resultado) return null;
  return resultado.ok ? (
    <p className="text-sm text-[var(--fo-success)]">{resultado.message ?? "Listo."}</p>
  ) : (
    <p className="text-sm text-[var(--fo-danger)]" role="alert">
      {resultado.error}
    </p>
  );
}
