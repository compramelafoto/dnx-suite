export type PolaroidFontOption = {
  label: string;
  value: string;
};

// Recomendaciones de uso:
// - Inter / DM Sans → estilo moderno minimal
// - Playfair / Cormorant / Lora → estilo elegante
// - Bebas / Abril / Oswald → estilo fuerte
// - Great Vibes / Dancing Script / Satisfy → estilo romántico
export const POLAROID_FONTS: PolaroidFontOption[] = [
  { label: "Inter", value: "inter" },
  { label: "Poppins", value: "poppins" },
  { label: "Montserrat", value: "montserrat" },
  { label: "Raleway", value: "raleway" },
  { label: "DM Sans", value: "dm-sans" },
  { label: "Space Grotesk", value: "space-grotesk" },
  { label: "Playfair Display", value: "playfair" },
  { label: "Cormorant Garamond", value: "cormorant" },
  { label: "Lora", value: "lora" },
  { label: "Bebas Neue", value: "bebas" },
  { label: "Abril Fatface", value: "abril" },
  { label: "Oswald", value: "oswald" },
  { label: "Great Vibes", value: "great-vibes" },
  { label: "Dancing Script", value: "dancing-script" },
  { label: "Satisfy", value: "satisfy" },
  { label: "Pacifico", value: "pacifico" },
];

export const POLAROID_FONT_FAMILY: Record<string, string> = {
  inter: "Inter",
  poppins: "Poppins",
  montserrat: "Montserrat",
  raleway: "Raleway",
  "dm-sans": "DM Sans",
  "space-grotesk": "Space Grotesk",
  playfair: "Playfair Display",
  cormorant: "Cormorant Garamond",
  lora: "Lora",
  bebas: "Bebas Neue",
  abril: "Abril Fatface",
  oswald: "Oswald",
  "great-vibes": "Great Vibes",
  "dancing-script": "Dancing Script",
  satisfy: "Satisfy",
  pacifico: "Pacifico",
};

export const POLAROID_FONT_FALLBACK = "Inter, sans-serif";

export function getPolaroidFontFamily(value?: string | null) {
  return POLAROID_FONT_FAMILY[value ?? ""] || "Inter";
}

export function normalizePolaroidFontValue(value?: string | null) {
  if (!value) return "inter";
  const direct = POLAROID_FONT_FAMILY[value];
  if (direct) return value;
  const lower = value.toLowerCase();
  const byKey = POLAROID_FONT_FAMILY[lower];
  if (byKey) return lower;
  const match = Object.entries(POLAROID_FONT_FAMILY).find(
    ([, name]) => name.toLowerCase() === lower
  );
  return match?.[0] ?? "inter";
}

/**
 * Baja y registra en el navegador las tipografías que se van a usar, en normal y negrita.
 *
 * En CompraMeLaFoto la lista se declaraba pero nada las cargaba, y el lienzo dibujaba todo con
 * la de reemplazo. Se bajan de Fontsource (el juego latino), como el resto de FOTOFFICE; si una
 * variante no existe —varias son de un solo peso— el navegador la sintetiza a partir de la otra.
 */
const fuentesPedidas = new Map<string, Promise<void>>();

function fontsourceUrl(familia: string, peso: 400 | 700) {
  const slug = familia.trim().toLowerCase().replace(/\s+/g, "-");
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${peso}-normal.woff2`;
}

function cargarVariante(familia: string, peso: 400 | 700): Promise<void> {
  const clave = `${familia}:${peso}`;
  let pedido = fuentesPedidas.get(clave);
  if (!pedido) {
    const cara = new FontFace(familia, `url(${fontsourceUrl(familia, peso)})`, { weight: String(peso) });
    pedido = cara
      .load()
      .then((cargada) => {
        document.fonts.add(cargada);
      })
      .catch(() => {});
    fuentesPedidas.set(clave, pedido);
  }
  return pedido;
}

export async function cargarFuentesPolaroid(valores?: Array<string | null | undefined>): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return;
  const familias = valores
    ? [...new Set(valores.map((v) => getPolaroidFontFamily(normalizePolaroidFontValue(v))))]
    : Object.values(POLAROID_FONT_FAMILY);
  await Promise.all(familias.flatMap((f) => [cargarVariante(f, 400), cargarVariante(f, 700)]));
}
