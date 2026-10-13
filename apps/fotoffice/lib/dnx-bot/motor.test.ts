import { describe, expect, it } from "vitest";
import { toInputSchema } from "@repo/dnx-bot";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { normalizarPerfil } from "@/lib/precios/perfil-datos";
import { resumirPerfil } from "@/lib/precios/resumen";
import { aplicarParche, cambiosEntre, esquemaParchePerfil, perfilBase, simularPerfil, tarjetaDelPerfil, vistaDelPerfil } from "./motor";

const completo = () => createBaseCompleteProfile();
const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

describe("esquemaParchePerfil", () => {
  it("convierte a JSON Schema de objeto", () => {
    expect(toInputSchema(esquemaParchePerfil).type).toBe("object");
  });
  it("los montos son sólo dígitos: el modelo no puede mandar '$450.000' ni 'lo normal'", () => {
    expect(esquemaParchePerfil.safeParse({ ingresosExternos: "600000" }).success).toBe(true);
    expect(esquemaParchePerfil.safeParse({ ingresosExternos: "$600.000" }).success).toBe(false);
    expect(esquemaParchePerfil.safeParse({ ingresosExternos: "lo normal" }).success).toBe(false);
    expect(esquemaParchePerfil.safeParse({ posicionamiento: "carisimo" }).success).toBe(false);
  });
});

describe("perfilBase", () => {
  it("sin perfil guardado parte del perfil inicial normalizado (pesos, rubros por omisión)", () => {
    const b = perfilBase(null);
    expect(b.currency).toBe("ARS");
    expect(b.personalExpenseGroups.length).toBeGreaterThan(3);
  });
});

describe("aplicarParche", () => {
  it("parche vacío no cambia nada", () => {
    const r = aplicarParche(completo(), {});
    expect(r.errores).toEqual([]);
    expect(r.perfil).toEqual(normalizarPerfil(completo()));
  });

  it("pasa cada dato a su campo del perfil", () => {
    const r = aplicarParche(perfilBase(null), {
      viveSoloDeFotografia: "no",
      ingresosExternos: "600000",
      gastosPersonales: [
        { grupoId: "housing", itemId: "rent-mortgage", monto: "450000" },
        { grupoId: "food", itemId: "supermarket", monto: "350000" },
      ],
      negocio: { alquiler: "0", software: "30000", publicidad: "20000", colaboradores: "0" },
      equipo: { renovacionMensual: "50000" },
      fondoEmergencia: "20000",
      ahorro: "30000",
      posicionamiento: "growing",
    });
    expect(r.errores).toEqual([]);
    const p = r.perfil;
    expect(p.livesOnlyFromPhotography).toBe("no");
    expect(p.externalMonthlyIncome).toBe("600000");
    expect(p.personalExpenseGroups.find((g) => g.id === "housing")!.items.find((i) => i.id === "rent-mortgage")!.amount).toBe("450000");
    expect(p.businessSoftware).toBe("30000");
    expect(p.employeesCount).toBe("0");
    expect(p.equipmentRenewalMonthly).toBe("50000");
    expect(p.emergencyFundMonthly).toBe("20000");
    expect(p.savingsGoalsMonthly).toBe("30000");
    expect(p.commercialPositioningId).toBe("growing");
  });

  it("un renglón propio con etiqueta se suma al rubro; repetirlo lo actualiza", () => {
    const uno = aplicarParche(perfilBase(null), { gastosPersonales: [{ grupoId: "health", etiqueta: "Psicóloga", monto: "40000" }] });
    const dos = aplicarParche(uno.perfil, { gastosPersonales: [{ grupoId: "health", etiqueta: "psicóloga", monto: "45000" }] });
    const propios = dos.perfil.personalExpenseGroups.find((g) => g.id === "health")!.items.filter((i) => i.isCustom);
    expect(propios).toEqual([{ id: expect.stringMatching(/^dnxbot-/), label: "Psicóloga", amount: "45000", isCustom: true }]);
  });

  it("rubro o renglón inexistente: error, no se inventa nada", () => {
    const r = aplicarParche(perfilBase(null), {
      gastosPersonales: [
        { grupoId: "yates", itemId: "amarre", monto: "1" },
        { grupoId: "housing", itemId: "no-existe", monto: "1" },
      ],
    });
    expect(r.errores).toHaveLength(2);
    expect(JSON.stringify(r.perfil)).not.toContain("yates");
  });

  it("distribución en horas: se guarda en porcentajes y vuelve en las mismas horas", () => {
    const r = aplicarParche(completo(), {
      horasSemana: "45",
      distribucion: { unidad: "horas", coberturas: "10", edicion: "15", administracion: "7", ventas: "5", publicidad: "5", capacitacion: "3" },
    });
    expect(r.errores).toEqual([]);
    expect(vistaDelPerfil(r.perfil, null).datos.distribucionHoras).toEqual({
      coberturas: 10, edicion: 15, administracion: 7, ventas: 5, publicidad: 5, capacitacion: 3,
    });
  });

  it("horas por tarea que no suman: dice cuánto falta, sin redondear", () => {
    const r = aplicarParche(completo(), {
      horasSemana: "45",
      distribucion: { unidad: "horas", coberturas: "10", edicion: "15" },
    });
    expect(r.errores).toEqual(["Las horas por tarea suman 25 y tus horas por semana son 45: faltan repartir 20."]);
  });

  it("distribución en horas sin horas por semana: error", () => {
    const sinHoras = { ...completo(), weeklyHours: "" };
    expect(aplicarParche(sinHoras, { distribucion: { unidad: "horas", coberturas: "10" } }).errores[0]).toMatch(/horas por semana/);
  });

  it("distribución en porcentaje: se copia tal cual", () => {
    const r = aplicarParche(completo(), {
      distribucion: { unidad: "porcentaje", coberturas: "40", edicion: "30", administracion: "10", ventas: "10", publicidad: "5", capacitacion: "5" },
    });
    expect(r.perfil.timeDistribution).toEqual({ coverage: "40", editing: "30", administration: "10", sales: "10", marketing: "5", training: "5" });
  });
});

describe("simularPerfil y vistaDelPerfil", () => {
  it("el valor hora es el mismo que el del formulario (resumirPerfil), formateado", () => {
    const s = simularPerfil(completo(), {});
    const r = resumirPerfil(normalizarPerfil(completo())!);
    expect(s.errores).toEqual([]);
    expect(s.vista.completo).toBe(true);
    expect(s.vista.resumen.valorHora).toBe(pesos(r.valorHora!));
    expect(s.vista.resumen.costoHora).toBe(pesos(r.costoHora!));
  });

  it("perfil vacío: no hay valor hora y dice lo que falta, en el orden del motor", () => {
    const s = simularPerfil(perfilBase(null), {});
    expect(s.vista.completo).toBe(false);
    expect(s.vista.resumen.valorHora).toBeNull();
    expect(s.vista.faltan[0]).toBe("¿Vivís solo de la fotografía?");
  });

  it("devuelve el error de validación del formulario", () => {
    const s = simularPerfil(completo(), { distribucion: { unidad: "porcentaje", coberturas: "90", edicion: "90" } });
    expect(s.errores.join(" ")).toMatch(/distribución del tiempo no cierra/);
  });

  it("la vista lista todos los renglones de gastos con su id, para poder corregir", () => {
    const v = vistaDelPerfil(normalizarPerfil(completo())!, "manual");
    const vivienda = v.datos.gastosPersonalesPorGrupo.find((g) => g.grupoId === "housing")!;
    expect(vivienda.renglones.find((r) => r.itemId === "rent-mortgage")!.monto).toBe(pesos(200000));
    expect(vivienda.renglones.some((r) => r.monto === null)).toBe(true);
    expect(v.origen).toBe("manual");
  });
});

describe("tarjetaDelPerfil", () => {
  it("filas con las cifras del servidor y avisos con lo que falta", () => {
    const t = tarjetaDelPerfil(simularPerfil(perfilBase(null), { viveSoloDeFotografia: "si" }));
    expect(t.titulo).toBe("Tu perfil de precios");
    expect(t.filas.find((f) => f.etiqueta === "Valor hora")!.valor).toBe("Falta completar");
    expect(t.avisos.length).toBeGreaterThan(0);
    const c = tarjetaDelPerfil(simularPerfil(completo(), {}));
    expect(c.filas.find((f) => f.etiqueta === "Valor hora")!.valor).toMatch(/\$/);
    expect(c.avisos).toEqual([]);
  });
});

describe("cambiosEntre", () => {
  it("lista cada dato cambiado con su etiqueta, antes y ahora", () => {
    const antes = normalizarPerfil(completo())!;
    const despues = aplicarParche(antes, { gastosPersonales: [{ grupoId: "food", itemId: "supermarket", monto: "350000" }], negocio: { software: "20000" } }).perfil;
    expect(cambiosEntre(antes, despues)).toEqual([
      { etiqueta: "Alimentación · Supermercado", antes: "sin dato", ahora: pesos(350000) },
      { etiqueta: "Software", antes: pesos(15000), ahora: pesos(20000) },
    ]);
  });
  it("sin cambios, lista vacía", () => {
    expect(cambiosEntre(normalizarPerfil(completo())!, normalizarPerfil(completo())!)).toEqual([]);
  });
});
