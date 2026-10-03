import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WebsiteHeaderView } from "@/components/website/render/website-header-view";
import { SiteFrame } from "@/components/website/render/site-frame";
import { DEFAULT_DESIGN_PRESETS, MENU_LAYOUTS, type MenuLayoutId, type WebsiteDesignPresets } from "./design-presets";
import type { SiteNavItem } from "./site-nav";

// Vive en `lib/` porque vitest sólo junta pruebas de `lib/` y `app/`. Dibuja el encabezado real
// en el servidor (sin navegador) con cada disposición del menú.
vi.mock("next/navigation", () => ({ usePathname: () => "/w/sfpr" }));

const navItems: SiteNavItem[] = [
  { id: "home", label: "Inicio", href: "/w/sfpr", exact: true, children: [] },
  { id: "bookings", label: "Reservas", href: "/w/sfpr/reservas", children: [] },
  { id: "ig", label: "Instagram", href: "https://instagram.com/sfpr", newTab: true, children: [] },
];

function dibujar(presets: Partial<WebsiteDesignPresets>): string {
  const designPresets = { ...DEFAULT_DESIGN_PRESETS, ...presets };
  return renderToStaticMarkup(
    createElement(SiteFrame, {
      designPresets,
      header: createElement(WebsiteHeaderView, { logoUrl: null, workspaceName: "SFPR", navItems, designPresets, homeHref: "/w/sfpr", loginHref: "/w/sfpr/entrar" }),
      children: createElement("main", null, "contenido"),
    }),
  );
}

describe("encabezado según la disposición del menú", () => {
  it.each(MENU_LAYOUTS.map((l) => l.id))("%s: todos los ítems y el botón de menú del celular", (layout: MenuLayoutId) => {
    const html = dibujar({ menuLayout: layout });
    for (const item of navItems) expect(html).toContain(`>${item.label}<`);
    expect(html).toContain('aria-label="Abrir el menú"');
    // El panel nace cerrado: no se puede tabular adentro.
    expect(html).toMatch(/inert=""[^>]*aria-hidden="true"|aria-hidden="true"[^>]*inert=""/);
  });

  it("un link externo con pestaña nueva lleva noopener", () => {
    expect(dibujar({})).toContain('href="https://instagram.com/sfpr" target="_blank" rel="noopener noreferrer"');
  });

  it("Inicio queda marcado como página actual", () => {
    expect(dibujar({})).toContain('href="/w/sfpr" aria-current="page"');
  });

  it("la barra superior muestra los ítems a la vista en pantallas grandes; el panel lateral no", () => {
    expect(dibujar({ menuLayout: "topbar" })).toContain('aria-label="Menú principal" class="hidden items-center');
    expect(dibujar({ menuLayout: "drawer" })).not.toContain("@3xl:flex");
  });

  it("la barra lateral fija pone el encabezado al costado del lado elegido", () => {
    expect(dibujar({ menuLayout: "sidebar", menuSide: "left" })).toContain('@3xl:flex-row"');
    expect(dibujar({ menuLayout: "sidebar", menuSide: "right" })).toContain("@3xl:flex-row-reverse");
    expect(dibujar({ menuLayout: "topbar" })).not.toContain("@3xl:flex-row");
  });

  it("los estilos de barra sólo aplican a la barra superior", () => {
    expect(dibujar({ menuLayout: "topbar", headerPreset: "floating" })).toContain("rounded-2xl shadow-md");
    expect(dibujar({ menuLayout: "modal", headerPreset: "floating" })).not.toContain("rounded-2xl shadow-md");
  });
});
