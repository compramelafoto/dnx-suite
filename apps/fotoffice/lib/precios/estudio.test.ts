import { describe, expect, it } from "vitest";
import { createStudioPerson, getProfileCostHour, INITIAL_STUDIO_STRUCTURE } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { perfilDanielSeparado } from "@repo/cuanto-cobro-core/__fixtures__/studio-fixtures";
import { computeStudioBreakdown } from "@repo/cuanto-cobro-core";
import { diasConSabadosAlternados, encenderMiEstudio, errorDeCamaras, errorDeEstudio, filasDeCoberturas, ofreceMiEstudio, retiroSugerido, separarLocal } from "./estudio";
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

describe("Local y coberturas", () => {
  /** El bloque de Daniel tal como estaba antes de separar: sin modo, sin `scope` y sin tiempo en el local. */
  const bloqueDeDaniel = () => {
    const { separateLocal: _s, ownerLocalTimePercent: _t, ...resto } = perfilDanielSeparado().studioStructure!;
    return { ...resto, people: resto.people.map(({ scope: _scope, ...p }) => p) };
  };
  const separado = (parcial: Partial<typeof INITIAL_STUDIO_STRUCTURE> = {}) => ({ ...perfilDanielSeparado().studioStructure!, ...parcial });

  it("separarLocal propone la clasificación: el local al local, software y publicidad compartidos, el equipo al local", () => {
    const e = separarLocal(bloqueDeDaniel());
    expect(e.separateLocal).toBe(true);
    const scope = (id: string) => e.fixedCostGroups.flatMap((g) => g.items).find((i) => i.id === id)!.scope;
    expect([scope("rent"), scope("software"), scope("ads")]).toEqual(["local", "shared", "shared"]);
    const equipo = e.people.filter((p) => p.role !== "owner");
    expect(equipo.map((p) => [p.name, p.scope])).toEqual([
      ["Camila", "local"],
      ["Sabina", "local"],
    ]);
    expect(e.people.find((p) => p.role === "owner")!.scope).toBeUndefined();
    expect(e.ownerLocalTimePercent).toBe("20");
  });

  it("separarLocal respeta lo que la persona ya eligió", () => {
    const antes = bloqueDeDaniel();
    const conEleccion = {
      ...antes,
      ownerLocalTimePercent: "30",
      fixedCostGroups: antes.fixedCostGroups.map((g) => ({ ...g, items: g.items.map((i) => (i.id === "rent" ? { ...i, scope: "shared" as const } : i)) })),
      people: antes.people.map((p) => (p.name === "Camila" ? { ...p, scope: "coverage" as const } : p)),
    };
    const e = separarLocal(conEleccion);
    expect(e.fixedCostGroups.flatMap((g) => g.items).find((i) => i.id === "rent")!.scope).toBe("shared");
    expect(e.people.find((p) => p.name === "Camila")!.scope).toBe("coverage");
    expect(e.ownerLocalTimePercent).toBe("30");
    expect(e.businessLines).toEqual(antes.businessLines);
  });

  it("errorDeEstudio revisa el sueldo del local, el tiempo en el local y la parte cobrable", () => {
    expect(errorDeEstudio(separado())).toBeNull();
    expect(errorDeEstudio(separado({ ownerLocalSalaryMonthly: "abc" }))).toBe("Revisá lo que te paga el local.");
    expect(errorDeEstudio(separado({ ownerLocalTimePercent: "120" }))).toBe("Revisá tu tiempo en el local.");
    const cobrable90 = separado().people.map((p) => (p.role === "owner" ? { ...p, billablePercent: "90" } : p));
    expect(errorDeEstudio(separado({ people: cobrable90, ownerLocalTimePercent: "20" }))).toBe(
      "Tu parte cobrable no puede ser mayor que el tiempo que no le das al local.",
    );
  });

  it("los porcentajes que usa el motor tienen la misma regla que la pantalla: «20,125» no se acepta", () => {
    expect(errorDeEstudio(separado({ ownerLocalTimePercent: "20,125" }))).toBe("Revisá tu tiempo en el local.");
    expect(errorDeEstudio(separado({ coverageSharePercent: "20,125" }))).toBe("Revisá el porcentaje de gastos compartidos que van a coberturas.");
    expect(errorDeEstudio(separado({ ownerLocalTimePercent: "20,5", coverageSharePercent: "70,25" }))).toBeNull();
  });

  it("sin el modo separado, esos campos no se revisan", () => {
    const cobrable90 = separado().people.map((p) => (p.role === "owner" ? { ...p, billablePercent: "90" } : p));
    expect(errorDeEstudio(separado({ separateLocal: false, ownerLocalSalaryMonthly: "abc", people: cobrable90 }))).toBeNull();
  });
});

describe("filasDeCoberturas", () => {
  const suma = (filas: { monto: number }[]) => filas.reduce((t, f) => t + f.monto, 0);
  const conDueno = (perfil: ReturnType<typeof perfilDanielSeparado>, cambio: Record<string, string>) => ({
    ...perfil,
    studioStructure: { ...perfil.studioStructure!, people: perfil.studioStructure!.people.map((p) => (p.role === "owner" ? { ...p, ...cambio } : p)) },
  });

  it("los renglones suman lo que tienen que cubrir las horas, con los insumos del dueño", () => {
    const d = computeStudioBreakdown(conDueno(perfilDanielSeparado(), { monthlySupplies: "50000" }))!;
    const filas = filasDeCoberturas(d);
    expect(filas.find((f) => f.etiqueta === "Tus insumos")?.monto).toBe(50_000);
    expect(filas[0]).toEqual({ etiqueta: "Lo que necesitás llevarte de las coberturas", monto: d.separated!.ownerNetNeed });
    expect(suma(filas)).toBeCloseTo(d.monthlyNeed, 6);
  });

  it("si el local paga más que tus gastos personales, lo que necesitás llevarte es 0 y la suma sigue cerrando", () => {
    const p = perfilDanielSeparado();
    const d = computeStudioBreakdown({ ...p, studioStructure: { ...p.studioStructure!, ownerLocalSalaryMonthly: "99000000" } })!;
    expect(d.separated!.ownerNetNeed).toBe(0);
    expect(suma(filasDeCoberturas(d))).toBeCloseTo(d.monthlyNeed, 6);
  });

  it("sin el modo separado no hay renglones", () => {
    expect(filasDeCoberturas({ ...computeStudioBreakdown(perfilDanielSeparado())!, separated: undefined })).toEqual([]);
  });
});
