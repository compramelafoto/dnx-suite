import { describe, expect, it } from "vitest";
import { convocatoriaDesdeFormData, datosParaGuardar } from "./mapear";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const completo = {
  id: "c1", title: "  Ciudad  ", basesText: "Bases", requirementsText: "", rightsText: "Autorizo",
  opensDay: "2026-11-01", closesDay: "2026-11-30", maxWorksPerPerson: "4",
};

describe("convocatoria desde el formulario", () => {
  it("limpia textos y lee el tope", () => {
    const f = convocatoriaDesdeFormData(fd(completo));
    expect(f).toMatchObject({ id: "c1", title: "Ciudad", requirementsText: null, maxWorksPerPerson: 4 });
  });
  it("un tope que no es número entero vuelve al valor por defecto", () => {
    expect(convocatoriaDesdeFormData(fd({ ...completo, maxWorksPerPerson: "dos" })).maxWorksPerPerson).toBe(3);
  });
  it("recorta textos enormes", () => {
    expect(convocatoriaDesdeFormData(fd({ ...completo, title: "x".repeat(500) })).title).toHaveLength(200);
  });
});

describe("qué se guarda según el estado", () => {
  const f = convocatoriaDesdeFormData(fd(completo));
  it("en borrador, todo, con las fechas en hora argentina", () => {
    const d = datosParaGuardar(f, "DRAFT");
    expect(d.opensAt?.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(d.closesAt?.toISOString()).toBe("2026-12-01T02:59:59.999Z");
    expect(d.maxWorksPerPerson).toBe(4);
  });
  it("abierta: ni apertura, ni tope, ni derechos", () => {
    const d = datosParaGuardar(f, "OPEN");
    expect(Object.keys(d).sort()).toEqual(["basesText", "closesAt", "requirementsText", "title"]);
  });
  it("cerrada: nada", () => expect(datosParaGuardar(f, "CLOSED")).toEqual({}));
  it("una fecha inválida tira", () => {
    expect(() => datosParaGuardar({ ...f, closesDay: "2026-02-30" }, "DRAFT")).toThrow();
  });
});
