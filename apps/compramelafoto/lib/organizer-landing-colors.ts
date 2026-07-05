export type OrganizerLandingColorOption = {
  hex: string;
  label: string;
};

/** Paleta sugerida para color principal (acento / marca). */
export const ORGANIZER_LANDING_PRIMARY_COLORS: OrganizerLandingColorOption[] = [
  { hex: "#c27b3d", label: "Cobre (marca)" },
  { hex: "#b45309", label: "Ámbar" },
  { hex: "#d97706", label: "Naranja" },
  { hex: "#dc2626", label: "Rojo" },
  { hex: "#e11d48", label: "Frambuesa" },
  { hex: "#db2777", label: "Rosa" },
  { hex: "#7c3aed", label: "Violeta" },
  { hex: "#2563eb", label: "Azul" },
  { hex: "#0891b2", label: "Cian" },
  { hex: "#059669", label: "Verde" },
  { hex: "#65a30d", label: "Lima" },
  { hex: "#ca8a04", label: "Dorado" },
];

/** Paleta sugerida para color secundario (textos, fondos oscuros). */
export const ORGANIZER_LANDING_SECONDARY_COLORS: OrganizerLandingColorOption[] = [
  { hex: "#1f2937", label: "Gris oscuro" },
  { hex: "#111827", label: "Casi negro" },
  { hex: "#374151", label: "Gris pizarra" },
  { hex: "#4b5563", label: "Gris medio" },
  { hex: "#1e3a5f", label: "Azul noche" },
  { hex: "#422006", label: "Marrón" },
  { hex: "#3f3f46", label: "Zinc" },
  { hex: "#0f766e", label: "Verde oscuro" },
  { hex: "#1e40af", label: "Azul profundo" },
  { hex: "#581c87", label: "Púrpura oscuro" },
  { hex: "#000000", label: "Negro" },
  { hex: "#ffffff", label: "Blanco" },
];

export function normalizeOrganizerHexColor(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9A-Fa-f]{3}$/i.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function findColorLabel(
  hex: string | null | undefined,
  options: OrganizerLandingColorOption[]
): string {
  const n = normalizeOrganizerHexColor(hex);
  if (!n) return "Elegir color";
  const hit = options.find((o) => o.hex.toLowerCase() === n);
  return hit?.label ?? n.toUpperCase();
}
