import { describe, expect, it } from "vitest";
import { aBloques, aTextoPlano, MARCA, regionTabla, REGION_SALTO, segmentarNegrita, sinMarca } from "./formato";

describe("segmentarNegrita", () => {
  it("separa lo que va en negrita", () => {
    expect(segmentarNegrita("a **b** c")).toEqual([
      { texto: "a ", negrita: false }, { texto: "b", negrita: true }, { texto: " c", negrita: false },
    ]);
  });
  it("un ** sin pareja queda como texto", () => {
    expect(segmentarNegrita("a **b")).toEqual([{ texto: "a **b", negrita: false }]);
    expect(segmentarNegrita("**a** y **b")).toEqual([
      { texto: "a", negrita: true }, { texto: " y **b", negrita: false },
    ]);
  });
  it("no deja segmentos vacíos", () => {
    expect(segmentarNegrita("")).toEqual([]);
    expect(segmentarNegrita("****")).toEqual([]);
  });
});

describe("aBloques", () => {
  it("títulos, párrafos con saltos simples y negrita", () => {
    const b = aBloques("# CONTRATO\n\n## Primera\nLínea uno\nLínea **dos**\n\nOtro párrafo");
    expect(b).toEqual([
      { tipo: "titulo", nivel: 1, segmentos: [{ texto: "CONTRATO", negrita: false }] },
      { tipo: "titulo", nivel: 2, segmentos: [{ texto: "Primera", negrita: false }] },
      { tipo: "parrafo", segmentos: [{ texto: "Línea uno\nLínea ", negrita: false }, { texto: "dos", negrita: true }] },
      { tipo: "parrafo", segmentos: [{ texto: "Otro párrafo", negrita: false }] },
    ]);
  });
  it("un # sin espacio o con tres no es título", () => {
    expect(aBloques("#sin espacio")[0]).toMatchObject({ tipo: "parrafo" });
    expect(aBloques("### tres")[0]).toMatchObject({ tipo: "parrafo" });
  });
  it("el HTML del usuario es texto, no se interpreta", () => {
    const b = aBloques("<script>alert(1)</script> <b>hola</b>");
    expect(b).toEqual([{ tipo: "parrafo", segmentos: [{ texto: "<script>alert(1)</script> <b>hola</b>", negrita: false }] }]);
  });
  it("salto de página y tabla vienen de regiones, en el orden del texto", () => {
    const tabla = regionTabla([["A", "B"], ["1", "2"]]);
    const b = aBloques(`Antes\n\n${tabla}\n\n${REGION_SALTO}\n\nDespués`);
    expect(b.map((x) => x.tipo)).toEqual(["parrafo", "tabla", "salto", "parrafo"]);
    expect(b[1]).toEqual({ tipo: "tabla", filas: [["A", "B"], ["1", "2"]] });
  });
  it("una región sin cierre se ignora y no queda la marca", () => {
    const b = aBloques(`hola ${MARCA}tabla${MARCA}a\tb`);
    expect(JSON.stringify(b)).not.toContain(MARCA);
    expect(b[0]).toMatchObject({ tipo: "parrafo" });
  });
  it("texto vacío no da bloques", () => {
    expect(aBloques("")).toEqual([]);
    expect(aBloques("\n \n")).toEqual([]);
  });
});

describe("regiones", () => {
  it("las celdas no pueden romper la tabla ni traer marcas", () => {
    const r = regionTabla([[`a\tb${MARCA}`, "c\nd"]]);
    expect(aBloques(r)).toEqual([{ tipo: "tabla", filas: [["a b", "c d"]] }]);
  });
  it("sinMarca saca el carácter", () => {
    expect(sinMarca(`a${MARCA}b`)).toBe("ab");
  });
  it("aTextoPlano deja las filas tabuladas legibles", () => {
    const t = aTextoPlano(`x\n${regionTabla([["A", "B"], ["1", "2"]])}\ny`);
    expect(t).toContain("A\tB\n1\t2");
    expect(t).not.toContain(MARCA);
  });
});

describe("salto de página seguido de una tabla", () => {
  const tabla = regionTabla([["Ítem", "Total"], ["Fotos", "$ 100"]]);
  const texto = `A\n${REGION_SALTO}\nB\n\n${tabla}\nC`;

  it("no se come el texto ni la tabla que vienen después del salto", () => {
    expect(aBloques(texto)).toEqual([
      { tipo: "parrafo", segmentos: [{ texto: "A", negrita: false }] },
      { tipo: "salto" },
      { tipo: "parrafo", segmentos: [{ texto: "B", negrita: false }] },
      { tipo: "tabla", filas: [["Ítem", "Total"], ["Fotos", "$ 100"]] },
      { tipo: "parrafo", segmentos: [{ texto: "C", negrita: false }] },
    ]);
  });

  it("el texto plano conserva B y la tabla", () => {
    const plano = aTextoPlano(texto);
    expect(plano).toContain("B");
    expect(plano).toContain("Fotos\t$ 100");
    expect(plano).not.toContain(MARCA);
  });
});
