import { getBlockPreviewLabel, type WebsiteBlock } from "./blocks";

/**
 * Navegación del Header (Parte 8, alcance acotado para esta etapa): en vez de una UI separada
 * para armar el menú a mano, cada sección visible con título se vuelve un item de navegación
 * automáticamente — "click en Nosotros → anchor de esa sección", sin pedirle al usuario que
 * arme nada. Home siempre existe y siempre es el primer item, apuntando al tope de la página.
 * No hay páginas internas todavía (fuera de alcance, ver informe) — todo son anchors de Home.
 *
 * El slug se deriva del mismo texto que ya se ve en la tarjeta de la sección
 * (`getBlockPreviewLabel`), así el link del menú y lo que el usuario ve en "Secciones"
 * coinciden siempre — nunca hay que mantenerlos sincronizados a mano.
 */
export type WebsiteNavItem = {
  id: string;
  label: string;
  anchor: string | null; // null = Home (tope de página)
};

const RESERVED_ANCHORS = new Set(["top", "home", "inicio", "menu", "header", "footer"]);

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Slug determinístico por bloque — lo usan tanto el renderer (para poner el `id` real en el
 * HTML) como el menú (para generar el `href`) a partir del mismo algoritmo, así nunca divergen. */
export function anchorSlugForBlock(block: WebsiteBlock, index: number): string {
  const raw = slugify(getBlockPreviewLabel(block));
  const base = raw && !RESERVED_ANCHORS.has(raw) ? raw : `seccion-${index + 1}`;
  return base;
}

/** Deduplica sufijando -2, -3... si dos secciones generan el mismo slug (ej. dos bloques Texto
 * sin título). Determinístico: siempre el mismo resultado para el mismo array de bloques. */
export function deriveHomeNavItems(blocks: WebsiteBlock[]): WebsiteNavItem[] {
  const visible = [...blocks].filter((b) => b.visible).sort((a, b) => a.order - b.order);
  const seen = new Map<string, number>();
  const items: WebsiteNavItem[] = [{ id: "home", label: "Inicio", anchor: null }];

  visible.forEach((block, i) => {
    const label = getBlockPreviewLabel(block);
    if (!label || block.type === "SPACER") return;
    let slug = anchorSlugForBlock(block, i);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count + 1}`;
    items.push({ id: block.id, label, anchor: slug });
  });

  return items;
}

/** `blockId -> anchor` ya dedupeado — lo usa el renderer para poner el `id` real en el HTML de
 * cada sección. Deriva de `deriveHomeNavItems` para que el anchor real y el que ve el menú sean
 * siempre exactamente el mismo (nunca se calculan por separado). */
export function anchorMapForBlocks(blocks: WebsiteBlock[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of deriveHomeNavItems(blocks)) {
    if (item.anchor) map.set(item.id, item.anchor);
  }
  return map;
}
