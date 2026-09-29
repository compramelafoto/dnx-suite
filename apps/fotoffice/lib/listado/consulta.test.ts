import { describe, expect, it } from "vitest";
import { escribirConsulta, hayConsultaEnDireccion, leerConsulta } from "./consulta";
import type { DefinicionListado } from "./tipos";

const def = {
  clave: "prueba",
  filtros: [
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [{ valor: "ACTIVO", etiqueta: "Activo" }] },
    { tipo: "relacion", clave: "categoria", etiqueta: "Categoría" },
    { tipo: "periodo", clave: "alta", etiqueta: "Alta" },
    { tipo: "siNo", clave: "deuda", etiqueta: "Deuda", si: "Con deuda", no: "Al día" },
  ],
  ordenes: ["nombre", "alta"],
  ordenPorDefecto: { campo: "nombre", desc: false },
} as unknown as DefinicionListado<unknown>;

const p = (s: string) => new URLSearchParams(s);

describe("leerConsulta", () => {
  it("sin parámetros devuelve los valores por defecto", () => {
    const { consulta, descartados } = leerConsulta(def, p(""));
    expect(consulta).toEqual({
      q: "", filtros: {}, orden: { campo: "nombre", desc: false }, pagina: 1, filas: 25, ver: null,
    });
    expect(descartados).toEqual([]);
  });

  it("lee búsqueda, filtros válidos, orden descendente, página, filas y ver", () => {
    const { consulta } = leerConsulta(
      def,
      p("q=%20perez%20&estado=ACTIVO&categoria=cat_1&alta=este-mes&deuda=si&orden=-alta&pagina=3&filas=50&ver=abc"),
    );
    expect(consulta).toEqual({
      q: "perez",
      filtros: { estado: "ACTIVO", categoria: "cat_1", alta: "este-mes", deuda: "si" },
      orden: { campo: "alta", desc: true },
      pagina: 3,
      filas: 50,
      ver: "abc",
    });
  });

  it("descarta filtros no declarados, valores fuera de lista y órdenes inventados", () => {
    const { consulta, descartados } = leerConsulta(
      def,
      p("workspaceId=otro&estado=BORRADO&orden=-password&filas=1000&pagina=-2&deuda=quizas&alta=ayer"),
    );
    expect(consulta.filtros).toEqual({});
    expect(consulta.orden).toEqual({ campo: "nombre", desc: false });
    expect(consulta.filas).toBe(25);
    expect(consulta.pagina).toBe(1);
    expect(descartados.sort()).toEqual(["alta", "deuda", "estado", "filas", "orden", "pagina", "workspaceId"]);
  });

  it("acepta un rango de período y rechaza rangos invertidos o mal formados", () => {
    expect(leerConsulta(def, p("alta=2026-01-01..2026-03-31")).consulta.filtros.alta).toBe("2026-01-01..2026-03-31");
    expect(leerConsulta(def, p("alta=2026-03-31..2026-01-01")).consulta.filtros.alta).toBeUndefined();
    expect(leerConsulta(def, p("alta=2026-13-01..2026-14-01")).consulta.filtros.alta).toBeUndefined();
  });

  it("un id de relación con caracteres raros se descarta", () => {
    expect(leerConsulta(def, p("categoria=a'%20OR%201=1")).consulta.filtros.categoria).toBeUndefined();
  });

  it("recorta la búsqueda a 100 caracteres", () => {
    expect(leerConsulta(def, p(`q=${"x".repeat(300)}`)).consulta.q).toHaveLength(100);
  });
});

describe("escribirConsulta", () => {
  it("omite lo que está en su valor por defecto", () => {
    const { consulta } = leerConsulta(def, p(""));
    expect(escribirConsulta(def, consulta)).toBe("");
  });

  it("aplica cambios y vuelve a la página 1 si cambia un filtro o la búsqueda", () => {
    const { consulta } = leerConsulta(def, p("estado=ACTIVO&pagina=4"));
    expect(escribirConsulta(def, consulta, { q: "ana" })).toBe("q=ana&estado=ACTIVO");
    expect(escribirConsulta(def, consulta, { pagina: 5 })).toBe("estado=ACTIVO&pagina=5");
    expect(escribirConsulta(def, consulta, { filtros: { estado: null } })).toBe("");
  });

  it("escribe el orden descendente con guion", () => {
    const { consulta } = leerConsulta(def, p(""));
    expect(escribirConsulta(def, consulta, { orden: { campo: "alta", desc: true } })).toBe("orden=-alta");
  });
});

describe("hayConsultaEnDireccion", () => {
  it("sólo cuenta parámetros de lista, no mensajes como ok o error", () => {
    expect(hayConsultaEnDireccion(p("ok=1&error=x"))).toBe(false);
    expect(hayConsultaEnDireccion(p("estado=ACTIVO"))).toBe(true);
    expect(hayConsultaEnDireccion(p("limpio=1"))).toBe(true);
  });
});
