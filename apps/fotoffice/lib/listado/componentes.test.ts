import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(__dirname, "..", "..", "components/listado");
const fuente = (archivo: string) => readFileSync(join(DIR, archivo), "utf8");
const esCliente = (archivo: string) => /^\s*["']use client["'];?/.test(fuente(archivo));

const ARCHIVOS = [
  "listado.tsx",
  "caja-de-busqueda.tsx",
  "barra-de-filtros.tsx",
  "filtro-relacion.tsx",
  "etiquetas-de-filtro.tsx",
  "menu-de-vistas.tsx",
  "tabla.tsx",
  "paginador.tsx",
  "seleccion.tsx",
  "panel-lateral.tsx",
  "fila.tsx",
];

describe("componentes del listado", () => {
  it("existen todos los archivos", () => {
    for (const a of ARCHIVOS) expect(existsSync(join(DIR, a)), a).toBe(true);
  });

  it("el listado corre en el servidor; los interactivos, en el navegador", () => {
    expect(esCliente("listado.tsx")).toBe(false);
    expect(esCliente("etiquetas-de-filtro.tsx")).toBe(false);
    expect(esCliente("tabla.tsx")).toBe(false);
    expect(esCliente("paginador.tsx")).toBe(false);
    for (const a of ["caja-de-busqueda.tsx", "seleccion.tsx", "panel-lateral.tsx", "fila.tsx", "menu-de-vistas.tsx", "filtro-relacion.tsx"]) {
      expect(esCliente(a), a).toBe(true);
    }
  });

  it("la búsqueda espera medio segundo y dos letras", () => {
    const src = fuente("caja-de-busqueda.tsx");
    expect(src).toMatch(/500/);
    expect(src).toMatch(/length >= 2/);
  });

  it("el listado recuerda la última consulta", () => {
    const src = fuente("listado.tsx");
    expect(src).toMatch(/leerUltima\(/);
    expect(src).toMatch(/guardarUltima\(/);
  });

  it("Exportar sólo aparece con verDinero", () => {
    const src = fuente("listado.tsx");
    const guarda = src.indexOf('exigirCapacidad(ctx, "verDinero")');
    expect(guarda).toBeGreaterThan(-1);
    const boton = src.search(/\n\s*Exportar\s*\n/);
    expect(boton).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(boton);
  });

  it("ningún componente toca la base directamente", () => {
    for (const a of readdirSync(DIR)) expect(fuente(a), a).not.toMatch(/from ["']@repo\/db/);
  });

  it("accesibilidad: orden, casillas y panel", () => {
    expect(fuente("tabla.tsx")).toMatch(/aria-sort/);
    expect(fuente("seleccion.tsx")).toMatch(/Seleccionar fila/);
    expect(fuente("seleccion.tsx")).toMatch(/Seleccionar toda la página/);
    expect(fuente("panel-lateral.tsx")).toMatch(/role="complementary"/);
    expect(fuente("panel-lateral.tsx")).toMatch(/\.focus\(/);
  });

  it("la barra de selección atrapa una falla del servidor y la muestra, sin romper la página", () => {
    const src = fuente("barra-de-seleccion.tsx");
    for (const llamada of ["prepararLoteAction(", "aplicarLoteAction("]) {
      const i = src.indexOf(`await ${llamada}`);
      expect(i, llamada).toBeGreaterThan(-1);
      const antes = src.slice(0, i);
      const despues = src.slice(i);
      expect(antes.lastIndexOf("try {"), llamada).toBeGreaterThan(antes.lastIndexOf("startTransition("));
      expect(despues.indexOf("catch"), llamada).toBeLessThan(despues.indexOf("setError(ERROR_INESPERADO_LOTE)"));
    }
    expect(src).toContain('"No se pudo completar la acción. Probá de nuevo."');
  });
});
