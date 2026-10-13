import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHighlightedNavBadge, navBadgeClassName } from "@/components/panels/nav-badge";

describe("etiquetas del menú", () => {
  it("NUEVO va en verde esmeralda oscuro con texto blanco", () => {
    const cls = navBadgeClassName("NUEVO");
    assert.match(cls, /bg-emerald-700/);
    assert.match(cls, /text-white/);
    assert.doesNotMatch(cls, /bg-blue-500/);
  });
  it("reconoce NUEVO sin importar mayúsculas ni espacios", () => {
    assert.equal(navBadgeClassName(" nuevo "), navBadgeClassName("NUEVO"));
    assert.equal(isHighlightedNavBadge("Nuevo"), true);
  });
  it("BETA y el resto siguen en azul", () => {
    for (const badge of ["BETA", "PRO", "", null, undefined]) {
      assert.match(navBadgeClassName(badge), /bg-blue-500 text-white/);
      assert.equal(isHighlightedNavBadge(badge), false);
    }
  });
  it("todas comparten tamaño y tipografía", () => {
    for (const badge of ["NUEVO", "BETA"]) {
      const cls = navBadgeClassName(badge);
      assert.match(cls, /text-\[10px\]/);
      assert.match(cls, /uppercase/);
      assert.match(cls, /shrink-0/);
    }
  });
  it("sin animaciones", () => {
    assert.doesNotMatch(navBadgeClassName("NUEVO"), /animate-/);
  });
});
