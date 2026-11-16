import { describe, expect, it } from "vitest";
import {
  OTROS,
  agrupar,
  motivoNoCompartible,
  normalizarEstilos,
  urlDelTrabajo,
  validarEnlaces,
  validarNombreRubro,
  type PortfolioTrabajo,
  type Rubro,
} from "./reglas";

const t = (p: Partial<PortfolioTrabajo> & { id: string }): PortfolioTrabajo => ({
  titulo: p.id,
  lugar: null,
  fecha: null,
  destacado: false,
  portadaUrl: null,
  rubroId: null,
  estilos: [],
  compartible: true,
  motivo: null,
  url: `https://x/${p.id}`,
  ...p,
});
const rubro = (id: string, orden: number): Rubro => ({ id, nombre: id.toUpperCase(), orden, enlaces: [] });

describe("normalizarEstilos", () => {
  it("normaliza estilos: recorta, une mayúsculas, tope 6 de 40", () => {
    expect(normalizarEstilos([" Book previo", "book previo", "", 3, "x".repeat(41), "Fiesta"])).toEqual(["Book previo", "Fiesta"]);
    expect(normalizarEstilos(["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(6);
    expect(normalizarEstilos("Fiesta")).toEqual([]);
  });
  it("une espacios repetidos por dentro", () => {
    expect(normalizarEstilos(["Book   previo", "book previo"])).toEqual(["Book previo"]);
  });
});

describe("validarEnlaces", () => {
  it("valida enlaces: sólo https, título ≤ 80, máx 10", () => {
    expect(
      validarEnlaces([
        { titulo: "XV", url: "https://www.compramelafoto.com/dnx/xv" },
        { titulo: "x", url: "http://a.com" },
        { titulo: "", url: "https://a.com" },
        { titulo: "y".repeat(81), url: "https://a.com" },
      ]),
    ).toEqual([{ titulo: "XV", url: "https://www.compramelafoto.com/dnx/xv" }]);
    expect(validarEnlaces(Array.from({ length: 12 }, (_, i) => ({ titulo: `t${i}`, url: `https://a.com/${i}` })))).toHaveLength(10);
    expect(validarEnlaces("nada")).toEqual([]);
  });
  it("rechaza URLs mal formadas", () => {
    expect(validarEnlaces([{ titulo: "a", url: "https://" }, { titulo: "b", url: "https://exa mple.com" }])).toEqual([]);
  });
});

describe("validarNombreRubro", () => {
  it("recorta y exige 1 a 60 caracteres", () => {
    expect(validarNombreRubro("  XV ")).toBe("XV");
    expect(validarNombreRubro("")).toBeNull();
    expect(validarNombreRubro("x".repeat(61))).toBeNull();
    expect(validarNombreRubro(3)).toBeNull();
  });
});

describe("urlDelTrabajo", () => {
  it("arma la URL con dominio propio, con /w/<slug> o null", () => {
    const b = { appOrigin: "https://fotoffice.com", categoriaSlug: "bodas", trabajoSlug: "sofi-y-misa" };
    expect(urlDelTrabajo({ ...b, customDomain: "dnxfotografia.com.ar", slug: "dnx-estudio" })).toBe("https://dnxfotografia.com.ar/trabajos/bodas/sofi-y-misa");
    expect(urlDelTrabajo({ ...b, customDomain: null, slug: "dnx-estudio" })).toBe("https://fotoffice.com/w/dnx-estudio/trabajos/bodas/sofi-y-misa");
    expect(urlDelTrabajo({ ...b, customDomain: null, slug: null })).toBeNull();
  });
  it("saca la barra final del origen", () => {
    expect(urlDelTrabajo({ appOrigin: "https://fotoffice.com/", customDomain: null, slug: "s", categoriaSlug: "c", trabajoSlug: "t" })).toBe(
      "https://fotoffice.com/w/s/trabajos/c/t",
    );
  });
});

describe("motivoNoCompartible", () => {
  it("motivo: borrador, sin categoría, oculta, sitio sin publicar; null si se puede compartir", () => {
    const ok = { estado: "PUBLICADO", categoriaVisible: true, sitioPublicado: true, url: "https://x" };
    expect(motivoNoCompartible(ok)).toBeNull();
    expect(motivoNoCompartible({ ...ok, estado: "BORRADOR" })).toBe("Es un borrador");
    expect(motivoNoCompartible({ ...ok, categoriaVisible: null })).toBe("No tiene categoría");
    expect(motivoNoCompartible({ ...ok, categoriaVisible: false })).toBe("Su categoría está oculta en el sitio");
    expect(motivoNoCompartible({ ...ok, sitioPublicado: false })).toBe("El sitio no está publicado");
    expect(motivoNoCompartible({ ...ok, url: null })).toBe("El sitio no tiene dirección pública");
  });
});

describe("agrupar", () => {
  it("agrupa por rubro (en orden) y estilo; varios estilos = aparece en cada uno; sin estilo = Otros", () => {
    const r = agrupar(
      [rubro("bodas", 1), rubro("xv", 0)],
      [
        t({ id: "a", rubroId: "xv", estilos: ["Book previo", "Sesión temática"] }),
        t({ id: "b", rubroId: "xv", estilos: ["Fiesta"] }),
        t({ id: "c", rubroId: "xv" }),
        t({ id: "d", rubroId: "bodas" }),
      ],
    );
    expect(r.grupos.map((g) => g.rubro.id)).toEqual(["xv", "bodas"]);
    const xv = r.grupos[0];
    expect(xv.total).toBe(3);
    expect(xv.estilos.map((e) => [e.estilo, e.trabajos.map((x) => x.id)])).toEqual([
      ["Book previo", ["a"]],
      ["Sesión temática", ["a"]],
      ["Fiesta", ["b"]],
      [OTROS, ["c"]],
    ]);
    expect(r.grupos[1].estilos).toEqual([{ estilo: OTROS, trabajos: [expect.objectContaining({ id: "d" })] }]);
  });

  it("dentro de un estilo: destacados primero, después fecha desc (sin fecha al final)", () => {
    const r = agrupar(
      [rubro("xv", 0)],
      [
        t({ id: "viejo", rubroId: "xv", estilos: ["Fiesta"], fecha: new Date("2020-01-01") }),
        t({ id: "sin", rubroId: "xv", estilos: ["Fiesta"] }),
        t({ id: "nuevo", rubroId: "xv", estilos: ["Fiesta"], fecha: new Date("2024-01-01") }),
        t({ id: "dest", rubroId: "xv", estilos: ["Fiesta"], destacado: true, fecha: new Date("2019-01-01") }),
      ],
    );
    expect(r.grupos[0].estilos[0].trabajos.map((x) => x.id)).toEqual(["dest", "nuevo", "viejo", "sin"]);
  });

  it("rubro inexistente o nulo → sinEtiquetar; rubro sin trabajos igual aparece con total 0", () => {
    const r = agrupar([rubro("xv", 0), rubro("infantiles", 1)], [t({ id: "a", rubroId: "borrado" }), t({ id: "b" }), t({ id: "c", rubroId: "xv" })]);
    expect(r.sinEtiquetar.map((x) => x.id)).toEqual(["a", "b"]);
    expect(r.grupos[1]).toEqual({ rubro: expect.objectContaining({ id: "infantiles" }), estilos: [], total: 0 });
  });
});
