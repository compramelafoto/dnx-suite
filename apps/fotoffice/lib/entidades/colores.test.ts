import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENTIDAD, ENTIDADES, estiloDeEntidad } from "./colores";

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

describe("colores por elemento", () => {
  it("cada elemento tiene su variable definida en globals.css", () => {
    for (const e of ENTIDADES) expect(css).toContain(`${ENTIDAD[e].variable}:`);
  });

  it("no hay dos elementos con el mismo color", () => {
    const colores = ENTIDADES.map((e) => new RegExp(`${ENTIDAD[e].variable}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1]?.toLowerCase());
    expect(colores.every(Boolean)).toBe(true);
    expect(new Set(colores).size).toBe(colores.length);
  });

  it("el estilo apunta a la variable del elemento", () => {
    expect(estiloDeEntidad("pedido")).toEqual({ "--ent": "var(--fo-ent-pedido)" });
  });
});

describe("elemento de cada ruta", () => {
  it("reconoce la pantalla y sus subpantallas, sin confundir prefijos", async () => {
    const { entidadDeRuta } = await import("./colores");
    expect(entidadDeRuta("/presupuestos")).toBe("cotizacion");
    expect(entidadDeRuta("/proyectos/en-curso")).toBe("proyecto");
    expect(entidadDeRuta("/consultas?vista=lista")).toBe("consulta");
    expect(entidadDeRuta("/pedidos-online")).toBeNull();
    expect(entidadDeRuta("/caja")).toBeNull();
  });
});
