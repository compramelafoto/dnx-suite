import { describe, expect, it } from "vitest";
import { avisoLaboratorios, deshacerConLab, hayCopiasDeLaboratorio, reemplazarGrupoLab, unirNombres } from "./ticket-laboratorio";

const r = (key: string) => ({ key });
const keys = (rows: { key: string }[]) => rows.map((x) => x.key);

describe("reemplazarGrupoLab", () => {
  it("la primera vez agrega el grupo al final", () => {
    expect(keys(reemplazarGrupoLab([r("a"), r("b")], [], [r("l1"), r("l2")]))).toEqual(["a", "b", "l1", "l2"]);
  });

  it("reemplaza el grupo en su lugar", () => {
    expect(keys(reemplazarGrupoLab([r("a"), r("l1"), r("l2"), r("b")], ["l1", "l2"], [r("n1")]))).toEqual(["a", "n1", "b"]);
  });

  it("sin los viejos en el ticket (se vació), el grupo nuevo va al final", () => {
    expect(keys(reemplazarGrupoLab([r("c")], ["l1"], [r("n1")]))).toEqual(["c", "n1"]);
  });

  it("un grupo nuevo vacío saca los viejos", () => {
    expect(keys(reemplazarGrupoLab([r("a"), r("l1"), r("b")], ["l1"], []))).toEqual(["a", "b"]);
  });
});

describe("deshacerConLab", () => {
  it("vuelve a un estado con el grupo actual: no cambia nada", () => {
    const res = deshacerConLab([r("a"), r("l1")], ["l1"], new Set(["l1"]));
    expect(keys(res.rows)).toEqual(["a", "l1"]);
    expect(res.sinGrupo).toBe(false);
  });

  it("vuelve a un estado sin el grupo: hay que olvidarlo", () => {
    const res = deshacerConLab([r("a")], ["l1"], new Set(["l1"]));
    expect(keys(res.rows)).toEqual(["a"]);
    expect(res.sinGrupo).toBe(true);
  });

  it("saca los renglones de una versión vieja del grupo o de un grupo quitado", () => {
    const res = deshacerConLab([r("a"), r("v1"), r("b")], null, new Set(["v1"]));
    expect(keys(res.rows)).toEqual(["a", "b"]);
    expect(res.sinGrupo).toBe(false);
  });

  it("un grupo a medias no queda suelto", () => {
    const res = deshacerConLab([r("l1"), r("a")], ["l1", "l2"], new Set(["l1", "l2"]));
    expect(keys(res.rows)).toEqual(["a"]);
    expect(res.sinGrupo).toBe(true);
  });

  it("un grupo sin renglones (Listo con nada) no se olvida", () => {
    expect(deshacerConLab([r("a")], [], new Set()).sinGrupo).toBe(false);
  });
});

describe("hayCopiasDeLaboratorio", () => {
  it("encuentra una copia del catálogo con precio", () => {
    expect(hayCopiasDeLaboratorio([{ id: "1", name: "Copia para mañana 10x15", priceMinor: 50000 }])).toBe(true);
  });

  it("sin copias, o con precio cero, no hay", () => {
    expect(hayCopiasDeLaboratorio([{ id: "1", name: "Portarretrato", priceMinor: 50000 }])).toBe(false);
    expect(hayCopiasDeLaboratorio([{ id: "1", name: "Copia instantánea 10x15", priceMinor: 0 }])).toBe(false);
  });
});

describe("avisoLaboratorios", () => {
  it("une los nombres con comas e «y»", () => {
    expect(unirNombres(["A"])).toBe("A");
    expect(unirNombres(["A", "B"])).toBe("A y B");
    expect(unirNombres(["A", "B", "C"])).toBe("A, B y C");
    expect(avisoLaboratorios(["Kodak", "Foto Sur"])).toBe("Las fotos se preparan y el pedido sale solo a Kodak y Foto Sur en unos minutos.");
  });
});
