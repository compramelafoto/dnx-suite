import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SERVICE_LEAD_EVENT_TYPES } from "@/lib/service-leads/form-definitions";
import {
  CAMPOS_POR_GRUPO,
  CATEGORIAS_CONTACTO,
  CATEGORIAS_DNX,
  CATEGORIAS_EQUIVALENTES,
  EQUIVALENCIA_EVENT_TYPE_DNX,
  GRUPOS_CONSULTA,
  ORIGENES_DNX,
  ORIGENES_EQUIVALENTES,
  ROLES_PARTICIPANTE_DNX,
  SLUG_DNX,
  categoriaEquivalente,
  esCategoriaContacto,
  esGrupoConsulta,
  grupoPide,
  semillasPara,
} from "./constantes";

describe("constantes de consultas", () => {
  it("los grupos y categorías de contacto son los del CHECK", () => {
    expect(GRUPOS_CONSULTA).toEqual(["BODA", "EVENTO", "TRABAJO_CON_FECHA", "TRABAJO_SIN_FECHA"]);
    expect(CATEGORIAS_CONTACTO).toEqual(["CONTACTO", "CLIENTE", "PROVEEDOR", "COLABORADOR"]);
    expect(esGrupoConsulta("BODA")).toBe(true);
    expect(esGrupoConsulta("boda")).toBe(false);
    expect(esCategoriaContacto("PROVEEDOR")).toBe(true);
    expect(esCategoriaContacto(null)).toBe(false);
  });

  it("cada grupo pide sus datos", () => {
    expect(CAMPOS_POR_GRUPO.BODA).toEqual(["fechaHora", "invitados", "novios", "ceremonia", "recepcion", "ciudad"]);
    expect(CAMPOS_POR_GRUPO.EVENTO).toEqual(["fechaHora", "invitados", "lugar", "ciudad"]);
    expect(CAMPOS_POR_GRUPO.TRABAJO_CON_FECHA).toEqual(["fechaHora", "lugar"]);
    expect(CAMPOS_POR_GRUPO.TRABAJO_SIN_FECHA).toEqual([]);
    expect(grupoPide("BODA", "lugar")).toBe(false);
    expect(grupoPide("EVENTO", "lugar")).toBe(true);
  });

  it("DNX tiene sus 21 categorías con grupo, sin nombres repetidos", () => {
    expect(CATEGORIAS_DNX).toHaveLength(21);
    expect(new Set(CATEGORIAS_DNX.map((c) => c.name)).size).toBe(21);
    const grupo = (n: string) => CATEGORIAS_DNX.find((c) => c.name === n)?.group;
    expect(grupo("Boda")).toBe("BODA");
    expect(grupo("Sesión de Fotos")).toBe("TRABAJO_SIN_FECHA");
    expect(grupo("Video Clip")).toBe("TRABAJO_CON_FECHA");
    expect(grupo("Bautismo")).toBe("EVENTO");
    expect(grupo("Bar Mitzvá.")).toBe("TRABAJO_CON_FECHA");
    const porGrupo = Object.fromEntries(GRUPOS_CONSULTA.map((g) => [g, CATEGORIAS_DNX.filter((c) => c.group === g).length]));
    expect(porGrupo).toEqual({ BODA: 1, EVENTO: 8, TRABAJO_CON_FECHA: 5, TRABAJO_SIN_FECHA: 7 });
  });

  it("los 9 tipos viejos tienen categoría equivalente, en DNX y en las demás", () => {
    expect(SERVICE_LEAD_EVENT_TYPES).toHaveLength(9);
    for (const t of SERVICE_LEAD_EVENT_TYPES) {
      expect(categoriaEquivalente(CATEGORIAS_DNX, t)).toBe(EQUIVALENCIA_EVENT_TYPE_DNX[t]);
      expect(categoriaEquivalente(CATEGORIAS_EQUIVALENTES, t)).not.toBeNull();
    }
    // Cada tipo viejo lo hereda una sola categoría.
    for (const lista of [CATEGORIAS_DNX, CATEGORIAS_EQUIVALENTES]) {
      const tipos = lista.map((c) => c.legacyEventType).filter((t) => t !== null);
      expect(new Set(tipos).size).toBe(tipos.length);
    }
    expect(EQUIVALENCIA_EVENT_TYPE_DNX.BODA).toBe("Boda");
    expect(EQUIVALENCIA_EVENT_TYPE_DNX.XV).toBe("Fotografía o Video de Cumpleaños de 15");
    expect(categoriaEquivalente(CATEGORIAS_DNX, "INVENTADO")).toBeNull();
    expect(categoriaEquivalente(CATEGORIAS_DNX, undefined)).toBeNull();
  });

  it("las demás organizaciones: 9 categorías, sólo el origen Otro y ningún rol", () => {
    expect(CATEGORIAS_EQUIVALENTES).toHaveLength(9);
    expect(CATEGORIAS_EQUIVALENTES.find((c) => c.legacyEventType === "BODA")).toMatchObject({ name: "Boda", group: "BODA" });
    expect(CATEGORIAS_EQUIVALENTES.find((c) => c.legacyEventType === "SESION_FOTOGRAFICA")?.group).toBe("TRABAJO_SIN_FECHA");
    const otra = semillasPara("otro-estudio");
    expect(otra.categorias).toBe(CATEGORIAS_EQUIVALENTES);
    expect(otra.origenes).toEqual(["Otro"]);
    expect(otra.roles).toEqual([]);
    expect(semillasPara(null).origenes).toBe(ORIGENES_EQUIVALENTES);
  });

  it("DNX: 21 categorías, 8 orígenes y 16 roles", () => {
    const dnx = semillasPara(SLUG_DNX);
    expect(dnx.categorias).toBe(CATEGORIAS_DNX);
    expect(ORIGENES_DNX).toHaveLength(8);
    expect(new Set(ORIGENES_DNX).size).toBe(8);
    expect(ROLES_PARTICIPANTE_DNX).toHaveLength(16);
    expect(new Set(ROLES_PARTICIPANTE_DNX).size).toBe(16);
    expect(ROLES_PARTICIPANTE_DNX).toContain("Fotógrafo Principal");
    expect(ROLES_PARTICIPANTE_DNX).toContain("Operador de Plataforma");
  });

  it("el slug de DNX es el mismo que usan los campos (0.5): los dos lo toman de lib/slug-dnx", () => {
    const fuente = readFileSync(join(__dirname, "..", "campos", "semillas.ts"), "utf8");
    expect(fuente).toContain('export { SLUG_DNX } from "@/lib/slug-dnx";');
    expect(SLUG_DNX).toBe("dnxestudio");
  });
});
