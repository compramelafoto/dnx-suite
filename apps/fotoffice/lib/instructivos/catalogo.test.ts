import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INSTRUCTIVOS, buscarInstructivo } from "./catalogo";
import { agruparPorSeccion, instructivosVisibles } from "./visibles";

describe("catálogo de instructivos", () => {
  it("cada slug es único y coincide con la búsqueda", () => {
    const slugs = INSTRUCTIVOS.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of INSTRUCTIVOS) expect(buscarInstructivo(g.slug)).toBe(g);
    expect(buscarInstructivo("no-existe")).toBeNull();
  });

  it("toda captura existe en public/ y tiene texto alternativo", () => {
    for (const g of INSTRUCTIVOS) {
      for (const p of g.pasos) {
        if (!p.imagen) continue;
        expect(p.imagen.startsWith(`/instructivos/${g.slug}/`), p.imagen).toBe(true);
        expect(existsSync(join(process.cwd(), "public", p.imagen)), p.imagen).toBe(true);
        expect(p.imagenAlt?.trim(), p.imagen).toBeTruthy();
      }
    }
  });

  it("muestra sólo las guías de los módulos que la persona ve", () => {
    const visibles = instructivosVisibles(INSTRUCTIVOS, { communications: "MANAGE", members: "VIEW" });
    expect(visibles.some((g) => g.slug === "carnets-pdf-imprimir")).toBe(true);
    expect(visibles.some((g) => g.slug === "primeros-pasos")).toBe(true);
    expect(visibles.some((g) => g.moduleKey === "cash")).toBe(false);
    expect(visibles.some((g) => g.soloAdministracion)).toBe(false);
    expect(agruparPorSeccion(visibles)[0]?.seccion).toBe("Primeros pasos");
    expect(instructivosVisibles(INSTRUCTIVOS, {}, true).some((g) => g.soloAdministracion)).toBe(true);
  });
});
