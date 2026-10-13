import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enlaceAlbum, enlaceReintento, RUTAS_COMPRADOR, RUTAS_PERMITIDAS_COMPRADOR, seccionPaginasDelComprador } from "./rutas";

const raiz = path.resolve(__dirname, "../../..");

describe("rutas del comprador", () => {
  it("cada ruta listada existe como page.tsx", () => {
    for (const r of RUTAS_COMPRADOR) expect(existsSync(path.join(raiz, r.pagina)), r.ruta).toBe(true);
  });
  it("prefijos permitidos sin llaves ni duplicados, con álbum y reintento", () => {
    expect(new Set(RUTAS_PERMITIDAS_COMPRADOR).size).toBe(RUTAS_PERMITIDAS_COMPRADOR.length);
    for (const p of RUTAS_PERMITIDAS_COMPRADOR) expect(p).toMatch(/^\/[a-z0-9/_-]+$/);
    expect(RUTAS_PERMITIDAS_COMPRADOR).toEqual(expect.arrayContaining(["/album", "/a", "/pago/reintentar"]));
  });
  it("la sección lista cada ruta y es determinística", () => {
    const s = seccionPaginasDelComprador();
    for (const r of RUTAS_COMPRADOR) expect(s).toContain(`- ${r.ruta}: ${r.proposito}`);
    expect(seccionPaginasDelComprador()).toBe(s);
  });
  it("enlaceAlbum usa el slug sólo si es seguro", () => {
    expect(enlaceAlbum({ id: 5, publicSlug: "Mi Album" })).toBe("/a/5");
    expect(enlaceAlbum({ id: 5, publicSlug: "mi-album" })).toBe("/album/mi-album");
    expect(enlaceAlbum({ id: 5, publicSlug: null })).toBe("/a/5");
  });
  it("enlaceReintento", () => {
    expect(enlaceReintento(123)).toBe("/pago/reintentar/123");
  });
});
