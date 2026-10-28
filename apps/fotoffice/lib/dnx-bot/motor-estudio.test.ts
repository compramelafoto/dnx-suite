/** DNX Bot y «Mi estudio» (E4): armar el estudio conversando y cotizar con quién hace qué. */
import { describe, expect, it } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { DANIEL, perfilConEstudio } from "@repo/cuanto-cobro-core/__fixtures__/studio-fixtures";
import { fusionarParches, loAnotado, rubrosSinDatos } from "./borrador";
import { aplicarParche, cambiosEntre, simularPerfil, tarjetaDelPerfil, type ParchePerfil } from "./motor";
import { cotizar, tarjetaDeCotizacion } from "./motor-trabajo";

const AHORA = new Date("2026-10-16T15:00:00.000Z");
const claves = () => {
  let n = 0;
  return () => `k${++n}`;
};

/** Lo que contaría Daniel: Sabi y Cami informales con todo pago, 5 días + sábados alternados, 8 h (supuesto). */
const PARCHE_DANIEL: ParchePerfil = {
  estudio: {
    activar: true,
    retiro: "1000000",
    ganancia: { monto: "500000" },
    tuJornada: { dias: "6", horasDia: "8", vendible: "60" },
    personas: [
      { nombre: "Sabi", contratacion: "informal", sueldo: "900000", dias: "5,5", horasDia: "8", vacaciones: "2" },
      { nombre: "Cami", contratacion: "informal", sueldo: "900000", dias: "5,5", horasDia: "8", vacaciones: "2" },
    ],
  },
  camaras: [{ nombre: "Carnets", valorReposicion: "500000", vidaUtil: "150000" }],
};

describe("armar Mi estudio conversando", () => {
  it("sólo en workspaces de tipo estudio (o si ya estaba encendido)", () => {
    const r = aplicarParche(createBaseCompleteProfile(), PARCHE_DANIEL);
    expect(r.errores.join(" ")).toContain("este workspace no es de tipo estudio");
    expect(aplicarParche(perfilConEstudio(DANIEL), { estudio: { retiro: "1200000" } }).errores).toEqual([]);
  });

  it("con permiso: personas informales, retiro, ganancia fija, jornada y otra cámara", () => {
    const { perfil, errores } = aplicarParche(createBaseCompleteProfile(), PARCHE_DANIEL, { permitirEstudio: true });
    expect(errores).toEqual([]);
    const e = perfil.studioStructure!;
    expect(e.enabled).toBe(true);
    expect([e.ownerDrawMonthly, e.desiredProfitMode, e.desiredProfitMonthly]).toEqual(["1000000", "amount", "500000"]);
    const sabi = e.people.find((p) => p.name === "Sabi")!;
    expect([sabi.employmentType, sabi.includeSac, sabi.paidVacations, sabi.workdaysPerWeek]).toEqual(["informal", true, true, "5,5"]);
    expect(perfil.cameras?.map((c) => [c.name, c.replacementValue, c.shutterRating])).toEqual([["Carnets", "500000", "150000"]]);
  });

  it("simular: la vista y la tarjeta traen el valor hora del estudio y el de cada persona (del motor)", () => {
    const s = simularPerfil(createBaseCompleteProfile(), PARCHE_DANIEL, null, { permitirEstudio: true });
    expect(s.errores).toEqual([]);
    expect(s.vista.estudio?.personas.map((p) => p.nombre)).toEqual(["Yo", "Sabi", "Cami"]);
    expect(s.vista.estudio?.personas[1]?.costoPorMes).toMatch(/975\.000/);
    const t = tarjetaDelPerfil(s);
    expect(t.titulo).toBe("Mi estudio");
    expect(t.filas.map((f) => f.etiqueta)).toContain("Hora de Sabi");
  });

  it("corregir a una persona por nombre y quitarla", () => {
    const base = aplicarParche(createBaseCompleteProfile(), PARCHE_DANIEL, { permitirEstudio: true }).perfil;
    const corregido = aplicarParche(base, { estudio: { personas: [{ nombre: "sabi", horasDia: "7" }, { nombre: "Cami", quitar: true }] } }).perfil;
    const gente = corregido.studioStructure!.people;
    expect(gente.find((p) => p.name === "Sabi")!.hoursPerWorkday).toBe("7");
    expect(gente.some((p) => p.name === "Cami")).toBe(false);
  });

  it("con el modo encendido, «colaboradores» no va: cada persona va en el equipo", () => {
    const r = aplicarParche(perfilConEstudio(DANIEL), { negocio: { colaboradores: "2" } });
    expect(r.errores.join(" ")).toContain("cada persona va en el equipo");
  });

  it("el borrador une las personas de dos anotaciones, campo por campo", () => {
    const a: ParchePerfil = { estudio: { personas: [{ nombre: "Sabi", sueldo: "900000" }] } };
    const b: ParchePerfil = { estudio: { personas: [{ nombre: "Cami", sueldo: "900000" }, { nombre: "Sabi", dias: "5,5" }] } };
    const f = fusionarParches(a, b);
    expect(f.estudio?.personas).toEqual([
      { nombre: "Sabi", sueldo: "900000", dias: "5,5" },
      { nombre: "Cami", sueldo: "900000" },
    ]);
    expect(loAnotado(f, createBaseCompleteProfile()).join(" | ")).toContain("Sabi (sueldo, dias)");
    expect(rubrosSinDatos(f, createBaseCompleteProfile())).toEqual([]);
  });

  it("la tarjeta «¿Lo hago?» lista lo que cambia del estudio", () => {
    const antes = createBaseCompleteProfile();
    const despues = aplicarParche(antes, PARCHE_DANIEL, { permitirEstudio: true }).perfil;
    const etiquetas = cambiosEntre(antes, despues).map((c) => c.etiqueta);
    expect(etiquetas).toEqual(expect.arrayContaining(["Mi estudio", "Tu retiro", "Ganancia del estudio", "Equipo · Sabi", "Cámara «Carnets»"]));
  });
});

describe("cotizar con quién hace qué", () => {
  const perfil = aplicarParche(createBaseCompleteProfile(), PARCHE_DANIEL, { permitirEstudio: true }).perfil;

  it("las asignaciones por nombre llegan al motor y la tarjeta dice quién lo hace", () => {
    const r = cotizar(
      perfil,
      {
        tipoDeTrabajo: "Boda",
        conceptos: [
          {
            nombre: "Cobertura",
            horasEdicion: "10",
            disparosEstimados: "2000",
            asignaciones: [
              { persona: "yo", actividad: "cobertura", horas: "6" },
              { persona: "Sabi", actividad: "cobertura", horas: "6" },
              { persona: "Cami", actividad: "edicion", horas: "10" },
            ],
          },
        ],
      },
      { nuevaClave: claves(), ahora: AHORA },
    );
    if (r.estado !== "OK") throw new Error(JSON.stringify(r));
    expect(r.resumen.conceptos[0]!.quienLoHace?.map((q) => [q.nombre, q.horas])).toEqual([
      ["Yo", "6 h"],
      ["Sabi", "6 h"],
      ["Cami", "10 h"],
    ]);
    expect(tarjetaDeCotizacion(r.resumen, "Boda").filas.map((f) => f.etiqueta)).toContain("Cobertura · Sabi");
  });

  it("carnet en la cámara de carnets, por nombre: $10 por unidad", () => {
    const r = cotizar(
      perfil,
      { tipoDeTrabajo: "Carnet", conceptos: [{ nombre: "Carnet", tipo: "physical-product", cantidad: "1", costoProveedor: "300", disparosEstimados: "3", camara: "carnets" }] },
      { nuevaClave: claves(), ahora: AHORA },
    );
    if (r.estado !== "OK") throw new Error(JSON.stringify(r));
    expect(r.resumen.total.costosVariables).toMatch(/310/);
  });

  it("persona o cámara que no están en el perfil: no se inventan", () => {
    const sinPersona = cotizar(perfil, { tipoDeTrabajo: "Boda", conceptos: [{ nombre: "Cobertura", asignaciones: [{ persona: "Juan", actividad: "cobertura", horas: "6" }] }] }, { nuevaClave: claves(), ahora: AHORA });
    expect(sinPersona).toMatchObject({ estado: "INVALIDO", error: "«Juan» no está en el equipo de Mi estudio: usá un nombre del perfil." });
    const sinCamara = cotizar(perfil, { tipoDeTrabajo: "Carnet", conceptos: [{ nombre: "Carnet", camara: "Leica" }] }, { nuevaClave: claves(), ahora: AHORA });
    expect(sinCamara).toMatchObject({ estado: "INVALIDO" });
  });

  it("sin Mi estudio, asignar horas es un error claro", () => {
    const r = cotizar(createBaseCompleteProfile(), { tipoDeTrabajo: "Boda", conceptos: [{ nombre: "Cobertura", horasCobertura: "6", asignaciones: [{ persona: "yo", actividad: "cobertura", horas: "6" }] }] }, { nuevaClave: claves(), ahora: AHORA });
    expect(r).toMatchObject({ estado: "INVALIDO" });
  });
});

describe("local y coberturas en Mi estudio (bot)", () => {
  const base = () => perfilConEstudio(DANIEL);
  const camposDe = (p: ReturnType<typeof base>) => cambiosEntre(createBaseCompleteProfile(), p).map((c) => c.etiqueta);

  it("separarLocal enciende el modo con scopes por defecto, sueldo y tiempo cargados", () => {
    const { perfil, errores } = aplicarParche(base(), { estudio: { separarLocal: true, sueldoDelLocal: "1000000", tiempoEnElLocal: "20" } });
    expect(errores).toEqual([]);
    const e = perfil.studioStructure!;
    expect(e.separateLocal).toBe(true);
    expect([e.ownerLocalSalaryMonthly, e.ownerLocalTimePercent]).toEqual(["1000000", "20"]);
    expect(e.fixedCostGroups.every((g) => g.items.every((i) => i.scope))).toBe(true);
    expect(e.people.filter((p) => p.role !== "owner").every((p) => p.scope === "local")).toBe(true);
  });

  it("de: compartido / coberturas / local en gastos fijos y personas", () => {
    const { perfil, errores } = aplicarParche(base(), {
      estudio: {
        separarLocal: true,
        gastosFijos: [{ rubroId: "premises", etiqueta: "Alquiler del local", monto: "300000", de: "compartido" }],
        personas: [{ nombre: "Sabi", de: "coberturas" }],
      },
    });
    expect(errores).toEqual([]);
    const e = perfil.studioStructure!;
    expect(e.fixedCostGroups.find((g) => g.id === "premises")!.items.find((i) => i.label === "Alquiler del local")!.scope).toBe("shared");
    expect(e.people.find((p) => p.name === "Sabi")!.scope).toBe("coverage");
  });

  it("porcentajes y montos nuevos: compartido, mercadería y estimado del local", () => {
    const { perfil, errores } = aplicarParche(base(), { estudio: { separarLocal: true, compartidoCoberturas: "50", costoMercaderia: "40", localEstimado: "800000" } });
    expect(errores).toEqual([]);
    const e = perfil.studioStructure!;
    expect([e.coverageSharePercent, e.localGoodsCostPercent, e.localMonthlyContributionManual]).toEqual(["50", "40", "800000"]);
  });

  it("tiempoEnElLocal fuera de 0 a 100: error claro y no se guarda", () => {
    const r = aplicarParche(base(), { estudio: { separarLocal: true, tiempoEnElLocal: "120" } });
    expect(r.errores).toContain("Tu tiempo en el local: tiene que ser un porcentaje entre 0 y 100.");
    expect(r.perfil.studioStructure!.ownerLocalTimePercent).toBe("20");
  });

  it("separarLocal: false apaga el modo sin borrar nada", () => {
    const on = aplicarParche(base(), { estudio: { separarLocal: true, sueldoDelLocal: "1000000" } }).perfil;
    const off = aplicarParche(on, { estudio: { separarLocal: false } }).perfil;
    expect(off.studioStructure!.separateLocal).toBe(false);
    expect(off.studioStructure!.ownerLocalSalaryMonthly).toBe("1000000");
  });

  it("la tarjeta ¿Lo hago? muestra «Lo que te paga el local» y deja de mostrar «Tu retiro» en modo separado", () => {
    const sin = camposDe(base());
    expect(sin).toContain("Tu retiro");
    const on = aplicarParche(base(), { estudio: { separarLocal: true, sueldoDelLocal: "1000000" } }).perfil;
    const cambios = cambiosEntre(base(), on).map((c) => c.etiqueta);
    expect(cambios).toContain("Lo que te paga el local");
    expect(cambios).not.toContain("Tu retiro");
    const eti = cambiosEntre(on, aplicarParche(on, { estudio: { retiro: "5" } }).perfil).map((c) => c.etiqueta);
    expect(eti).not.toContain("Tu retiro");
  });

  it("lo anotado nombra lo del local", () => {
    expect(loAnotado({ estudio: { separarLocal: true, sueldoDelLocal: "1", tiempoEnElLocal: "20" } }, base()).join(" ")).toMatch(/local y coberturas/i);
  });
});
