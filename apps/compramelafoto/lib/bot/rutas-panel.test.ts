import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RUTAS_PANEL, RUTAS_PERMITIDAS_BOT, seccionPantallasDelPanel } from "./rutas-panel";
import { buildSystemGuide } from "./guia";

const raiz = path.resolve(__dirname, "../..");

describe("rutas del panel del bot", () => {
  it("cada ruta listada existe como page.tsx", () => {
    for (const r of RUTAS_PANEL) expect(existsSync(path.join(raiz, r.pagina)), r.ruta).toBe(true);
  });
  it("la ruta es coherente con su archivo (salvo el grupo (panel))", () => {
    for (const r of RUTAS_PANEL) {
      const desdeArchivo = "/" + r.pagina.replace(/^app\//, "").replace(/\/page\.tsx$/, "").replace(/\/\([^)]*\)/g, "").replace(/\[(\w+)\]/g, "{id}");
      expect(r.ruta, r.pagina).toBe(desdeArchivo);
    }
  });
  it("los prefijos permitidos no tienen llaves ni duplicados y no incluyen /fotografo/albums", () => {
    expect(new Set(RUTAS_PERMITIDAS_BOT).size).toBe(RUTAS_PERMITIDAS_BOT.length);
    for (const p of RUTAS_PERMITIDAS_BOT) expect(p).toMatch(/^\/[a-z0-9/_-]+$/);
    expect(RUTAS_PERMITIDAS_BOT).toContain("/dashboard/albums");
    expect(RUTAS_PERMITIDAS_BOT).not.toContain("/fotografo/albums");
  });
  it("la guía incluye la sección, igual en cada llamada, y la regla de usar sólo esas rutas", () => {
    const g = buildSystemGuide();
    expect(g).toContain(seccionPantallasDelPanel());
    expect(g).toContain("Usá sólo rutas de esa lista");
    expect(buildSystemGuide()).toBe(g);
  });
});
