import { describe, expect, it } from "vitest";
import { createEmptyBlock, updateHeroSlide, type HeroBlock, type WebsiteBlock } from "./blocks";
import { anchorMapForBlocks, deriveHomeNavItems } from "./navigation";

/** El Hero guarda el título dentro de su primera placa, no en el nivel superior del config —
 * los demás bloques sí lo tienen directo. */
function withTitle(block: WebsiteBlock, title: string): WebsiteBlock {
  if (block.type === "HERO") {
    const hero = block as HeroBlock;
    return { ...hero, config: updateHeroSlide(hero.config, hero.config.slides[0].id, { title }) };
  }
  return { ...block, config: { ...block.config, title } } as WebsiteBlock;
}

describe("deriveHomeNavItems", () => {
  it("Home siempre existe y siempre es el primer item, con anchor null", () => {
    const items = deriveHomeNavItems([]);
    expect(items).toEqual([{ id: "home", label: "Inicio", anchor: null }]);
  });

  it("una sección visible con título se vuelve un item de nav con anchor derivado del título", () => {
    const hero = withTitle(createEmptyBlock("HERO", 0), "Sobre Nosotros");
    const items = deriveHomeNavItems([hero]);
    expect(items).toHaveLength(2);
    expect(items[1]).toEqual({ id: hero.id, label: "Sobre Nosotros", anchor: "sobre-nosotros" });
  });

  it("una sección oculta NO aparece en la navegación", () => {
    const hero = { ...withTitle(createEmptyBlock("HERO", 0), "Oculto"), visible: false } as WebsiteBlock;
    expect(deriveHomeNavItems([hero])).toEqual([{ id: "home", label: "Inicio", anchor: null }]);
  });

  it("SPACER nunca genera un item de navegación (no tiene contenido que anclar)", () => {
    const spacer = createEmptyBlock("SPACER", 0);
    expect(deriveHomeNavItems([spacer])).toEqual([{ id: "home", label: "Inicio", anchor: null }]);
  });

  it("dos secciones con el mismo título generan anchors distintos (-2, -3...)", () => {
    const a = withTitle(createEmptyBlock("TEXT", 0), "Contacto");
    const b = withTitle(createEmptyBlock("TEXT", 1), "Contacto");
    const items = deriveHomeNavItems([a, b]);
    const anchors = items.map((i) => i.anchor).filter(Boolean);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("es determinístico: el mismo array de bloques siempre produce los mismos anchors", () => {
    const blocks = [withTitle(createEmptyBlock("HERO", 0), "Bienvenidos"), withTitle(createEmptyBlock("TEXT", 1), "Nosotros")];
    expect(deriveHomeNavItems(blocks)).toEqual(deriveHomeNavItems(blocks));
  });
});

describe("anchorMapForBlocks", () => {
  it("el anchor real puesto en el HTML (vía este map) es exactamente el mismo que ve el menú", () => {
    const hero = withTitle(createEmptyBlock("HERO", 0), "Nuestra Historia");
    const map = anchorMapForBlocks([hero]);
    const navItem = deriveHomeNavItems([hero])[1];
    expect(map.get(hero.id)).toBe(navItem.anchor);
  });
});
