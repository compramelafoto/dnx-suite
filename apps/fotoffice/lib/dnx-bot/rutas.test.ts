import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prefijosPermitidos, RUTAS_BOT, rutasPara, seccionPantallas } from "./rutas";

const raiz = path.resolve(__dirname, "../..");
const TODO = { configurar: true, gestionarPresupuestos: true, verConsultas: true };
const STAFF = { configurar: false, gestionarPresupuestos: true, verConsultas: false };

describe("rutas que el bot puede mencionar", () => {
  it("son las nueve del spec (§6.6)", () => {
    expect(RUTAS_BOT.map((r) => r.ruta)).toEqual([
      "/workspace/configuracion/precios",
      "/workspace/configuracion/presupuestos",
      "/presupuestos",
      "/presupuestos/{id}",
      "/presupuestos/nuevo",
      "/consultas",
      "/consultas/{id}",
      "/consultas/nueva",
      "/ventas/catalogo",
    ]);
  });
  it("cada una existe como page.tsx", () => {
    for (const r of RUTAS_BOT) expect(existsSync(path.join(raiz, r.pagina)), r.ruta).toBe(true);
  });
  it("la ruta coincide con su archivo (sin los grupos entre paréntesis)", () => {
    for (const r of RUTAS_BOT) {
      const desdeArchivo =
        "/" + r.pagina.replace(/^app\//, "").replace(/\/page\.tsx$/, "").replace(/\([^)]*\)\//g, "").replace(/\[(\w+)\]/g, "{id}");
      expect(r.ruta, r.pagina).toBe(desdeArchivo);
    }
  });
  it("prefijos sin llaves ni duplicados", () => {
    const p = prefijosPermitidos(TODO);
    expect(new Set(p).size).toBe(p.length);
    for (const x of p) expect(x).toMatch(/^\/[a-z0-9/_-]+$/);
    expect(p).toContain("/presupuestos");
  });
  it("sin configurar no recibe Configuración; sin Consultas no recibe /consultas", () => {
    const rutas = rutasPara(STAFF).map((r) => r.ruta);
    expect(rutas.some((r) => r.startsWith("/workspace/configuracion"))).toBe(false);
    expect(rutas.some((r) => r.startsWith("/consultas"))).toBe(false);
    expect(rutas).toContain("/presupuestos/{id}");
    expect(prefijosPermitidos(STAFF)).not.toContain("/workspace/configuracion/precios");
  });
  it("la sección de la guía lista todas y es determinística", () => {
    const s = seccionPantallas();
    for (const r of RUTAS_BOT) expect(s).toContain(r.ruta);
    expect(seccionPantallas()).toBe(s);
  });
});
