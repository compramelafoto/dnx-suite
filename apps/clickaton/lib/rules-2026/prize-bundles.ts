/**
 * 10 prize bundles — asignación aleatoria sin repetición.
 * Contenido definitivo no requerido antes de abrir inscripción.
 */

export type PrizeBundleStatus =
  | "DRAFT"
  | "AVAILABLE"
  | "ASSIGNED"
  | "DELIVERED"
  | "REPLACED";

export type PrizeBundleDraft = {
  id: string;
  name: string;
  description?: string | null;
  sponsor?: string | null;
  items?: unknown[];
  referentialValueMinor?: number | null;
  status: PrizeBundleStatus;
};

export function assignRandomAvailableBundle(input: {
  bundles: PrizeBundleDraft[];
  random?: () => number;
}): { bundleId: string } | { error: "NO_AVAILABLE_BUNDLE" } {
  const available = input.bundles.filter((b) => b.status === "AVAILABLE");
  if (available.length === 0) return { error: "NO_AVAILABLE_BUNDLE" };
  const rnd = input.random ?? Math.random;
  const idx = Math.floor(rnd() * available.length);
  const pick = available[Math.min(idx, available.length - 1)]!;
  return { bundleId: pick.id };
}

export function ensurePrizeBundleSlots(count: number): Array<{ slot: number; status: "DRAFT" }> {
  return Array.from({ length: count }, (_, i) => ({
    slot: i + 1,
    status: "DRAFT" as const,
  }));
}
