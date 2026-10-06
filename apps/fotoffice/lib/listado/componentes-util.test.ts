import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hayConsultaEnDireccion } from "./consulta";
import { armarSeleccion, destinoConAvisos, firmaSeleccion } from "@/components/listado/util";

const DIR = join(__dirname, "..", "..", "components/listado");

describe("destinoConAvisos", () => {
  it("lleva a la última consulta sin perder el aviso de la dirección", () => {
    const sp = new URLSearchParams("ok=guardado");
    expect(destinoConAvisos("/caja/movimientos", "estado=A&pagina=1", sp)).toBe("/caja/movimientos?estado=A&pagina=1&ok=guardado");
  });
  it("conserva ok, error, forbidden y module; nada más", () => {
    const sp = new URLSearchParams("error=x&forbidden=operar&module=cash&otro=1&vista=v1");
    expect(destinoConAvisos("/clientes", "q=ana", sp)).toBe("/clientes?q=ana&error=x&forbidden=operar&module=cash");
  });
  it("una consulta vacía va con limpio=1: el destino no vuelve a redirigir", () => {
    const destino = destinoConAvisos("/clientes", "", new URLSearchParams("ok=1"));
    expect(destino).toBe("/clientes?limpio=1&ok=1");
    expect(hayConsultaEnDireccion(new URLSearchParams(destino.split("?")[1]))).toBe(true);
  });
  it("el destino de la última consulta siempre cuenta como consulta (sin bucle)", () => {
    const destino = destinoConAvisos("/clientes", "q=ana", new URLSearchParams("ok=1"));
    expect(hayConsultaEnDireccion(new URLSearchParams(destino.split("?")[1]))).toBe(true);
  });
  it("el listado usa el helper en sus dos redirects", () => {
    const src = readFileSync(join(DIR, "listado.tsx"), "utf8");
    expect(src.match(/redirect\(destinoConAvisos\(/g)).toHaveLength(2);
    expect(src).not.toMatch(/redirect\(`/);
  });
});

describe("selección de un lote", () => {
  it("la firma no depende del orden en que se tildaron las filas", () => {
    expect(firmaSeleccion(armarSeleccion(false, ["b", "a"], "q"))).toBe(firmaSeleccion(armarSeleccion(false, new Set(["a", "b"]), "q")));
  });
  it("tildar o destildar una fila cambia la firma", () => {
    expect(firmaSeleccion(armarSeleccion(false, ["a", "b"], ""))).not.toBe(firmaSeleccion(armarSeleccion(false, ["a"], "")));
  });
  it("todos los resultados se distinguen de las filas y de otra consulta", () => {
    expect(armarSeleccion(true, ["a"], "q=x")).toEqual({ tipo: "todos", query: "q=x" });
    expect(firmaSeleccion(armarSeleccion(true, [], "q=x"))).not.toBe(firmaSeleccion(armarSeleccion(true, [], "q=y")));
    expect(firmaSeleccion(armarSeleccion(true, [], ""))).not.toBe(firmaSeleccion(armarSeleccion(false, [], "")));
  });
  it("Confirmar manda la selección congelada en Continuar, no la tildada ahora", () => {
    const src = readFileSync(join(DIR, "barra-de-seleccion.tsx"), "utf8");
    const confirmar = src.slice(src.indexOf("function confirmar"), src.indexOf("return (", src.indexOf("function confirmar")));
    expect(confirmar).toMatch(/seleccion: previa\.seleccion/);
    expect(confirmar).toMatch(/parametro: previa\.parametro/);
    expect(src).toMatch(/confirmacion\.firma === firmaSeleccion\(seleccion\)/);
  });
});
