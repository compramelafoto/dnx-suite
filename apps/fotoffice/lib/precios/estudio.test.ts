import { describe, expect, it } from "vitest";
import { createStudioPerson, getProfileCostHour, INITIAL_STUDIO_STRUCTURE } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { diasConSabadosAlternados, encenderMiEstudio, errorDeCamaras, errorDeEstudio, ofreceMiEstudio, retiroSugerido } from "./estudio";
import { normalizarPerfil, validarPerfil } from "./perfil-datos";
import { resumirPerfil } from "./resumen";

describe("ofreceMiEstudio", () => {
  it("DNX Estudio (organizationType «local», activityType PHOTO_STUDIO) califica", () => {
    expect(ofreceMiEstudio({ organizationType: "local", activityType: "PHOTO_STUDIO" })).toBe(true);
  });
  it("ids de la portada, del esquema y viejos", () => {
    expect(ofreceMiEstudio({ organizationType: "estudio", activityType: null })).toBe(true);
    expect(ofreceMiEstudio({ organizationType: "PHOTOGRAPHY_COMPANY", activityType: null })).toBe(true);
    expect(ofreceMiEstudio({ organizationType: null, activityType: "agency" })).toBe(true);
    expect(ofreceMiEstudio({ organizationType: null, activityType: "studio" })).toBe(true);
  });
  it("freelance, asociaciones y sin datos: no", () => {
    expect(ofreceMiEstudio({ organizationType: "freelance", activityType: "FREELANCE_PHOTOGRAPHER" })).toBe(false);
    expect(ofreceMiEstudio({ organizationType: "sociedad", activityType: "PHOTOGRAPHERS_ASSOCIATION" })).toBe(false);
    expect(ofreceMiEstudio({ organizationType: null, activityType: null })).toBe(false);
    expect(ofreceMiEstudio(null)).toBe(false);
  });
});

describe("encenderMiEstudio", () => {
  it("precarga alquiler, software y publicidad, los colaboradores y la jornada", () => {
    const perfil = createBaseCompleteProfile({ employeesCount: "2", employeeMonthlyCost: "1800000", weeklyHours: "48" });
    const e = encenderMiEstudio(perfil);
    expect(e.enabled).toBe(true);
    const renglon = (id: string) => e.fixedCostGroups.flatMap((g) => g.items).find((i) => i.id === id)!.amount;
    expect([renglon("rent"), renglon("software"), renglon("ads")]).toEqual(["50000", "15000", "10000"]);
    const staff = e.people.filter((p) => p.role === "staff");
    expect(staff.map((p) => [p.name, p.monthlySalary, p.employmentType])).toEqual([
      ["Persona 1", "900000", ""],
      ["Persona 2", "900000", ""],
    ]);
    const owner = e.people.find((p) => p.role === "owner")!;
    expect([owner.workdaysPerWeek, owner.hoursPerWorkday]).toEqual(["5", "9,6"]);
  });
  it("si ya había un bloque, sólo lo enciende", () => {
    const guardado = { ...INITIAL_STUDIO_STRUCTURE, ownerDrawMonthly: "1000000" };
    const e = encenderMiEstudio(createBaseCompleteProfile({ studioStructure: guardado }));
    expect(e.enabled).toBe(true);
    expect(e.ownerDrawMonthly).toBe("1000000");
  });
  it("el retiro sugerido sale de los gastos personales (botón, nunca automático)", () => {
    expect(retiroSugerido(createBaseCompleteProfile())).toBe(200_000 + 15_000);
  });
  it("5 días + sábados alternados = 5,5", () => {
    expect(diasConSabadosAlternados(5)).toBe("5,5");
  });
});

describe("validación del perfil con Mi estudio", () => {
  const conEstudio = (parcial: Partial<typeof INITIAL_STUDIO_STRUCTURE>) =>
    createBaseCompleteProfile({ studioStructure: { ...INITIAL_STUDIO_STRUCTURE, enabled: true, ...parcial } });

  it("normalizarPerfil conserva el bloque y las cámaras; un perfil viejo sigue sin ellos", () => {
    const viejo = normalizarPerfil(createBaseCompleteProfile())!;
    expect("studioStructure" in viejo).toBe(false);
    expect("cameras" in viejo).toBe(false);
    const nuevo = normalizarPerfil({
      ...conEstudio({ ownerDrawMonthly: "1000000" }),
      cameras: [{ id: "cam-2", name: "Carnets", presetId: "custom", shutterRating: "150000", currentShutterCount: "", replacementValue: "500000" }],
    })!;
    expect(nuevo.studioStructure?.ownerDrawMonthly).toBe("1000000");
    expect(nuevo.cameras?.map((c) => c.id)).toEqual(["cam-2"]);
  });

  it("normalizarPerfil descarta un bloque que no es un objeto", () => {
    expect("studioStructure" in normalizarPerfil({ ...createBaseCompleteProfile(), studioStructure: "x" })!).toBe(false);
  });

  it("rechaza montos, porcentajes y días inválidos", () => {
    expect(validarPerfil(conEstudio({ ownerDrawMonthly: "mil" }))).toMatchObject({ ok: false, error: "Revisá el monto de tu retiro." });
    const mal = (p: Partial<ReturnType<typeof createStudioPerson>>) =>
      validarPerfil(conEstudio({ people: [...INITIAL_STUDIO_STRUCTURE.people, createStudioPerson({ id: "x", name: "Sabi", ...p })] }));
    expect(mal({ workdaysPerWeek: "cinco" })).toMatchObject({ ok: false });
    expect(mal({ workdaysPerWeek: "8" })).toMatchObject({ ok: false, error: "Sabi: no puede trabajar más de 7 días por semana." });
    expect(mal({ socialChargesPercent: "150" })).toMatchObject({ ok: false, error: "Revisá los porcentajes de Sabi." });
    expect(mal({ workdaysPerWeek: "5,5", hoursPerWorkday: "8" })).toMatchObject({ ok: true });
  });

  it("errorDeEstudio / errorDeCamaras con datos buenos", () => {
    expect(errorDeEstudio({ ...INITIAL_STUDIO_STRUCTURE })).toBeNull();
    expect(errorDeCamaras([{ id: "a", name: "A", presetId: "", shutterRating: "x", currentShutterCount: "", replacementValue: "" }])).toBe("Revisá los números de «A».");
  });

  it("el resumen del formulario usa el valor hora del estudio", () => {
    const perfil = conEstudio({
      ownerDrawMonthly: "1000000",
      people: [{ ...INITIAL_STUDIO_STRUCTURE.people[0]!, workdaysPerWeek: "5", hoursPerWorkday: "8" }],
    });
    const r = resumirPerfil(perfil);
    expect(r.completo).toBe(true);
    expect(r.estudio).not.toBeNull();
    expect(r.valorHora).toBeCloseTo(getProfileCostHour(perfil)!, 6);
    expect(r.gastosPersonales).toBe(1_000_000);
  });
});
