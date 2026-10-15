import { describe, expect, it } from "vitest";
import { toInputSchema } from "@repo/dnx-bot";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { normalizarPerfil } from "@/lib/precios/perfil-datos";
import { resumirPerfil } from "@/lib/precios/resumen";
import { aMensual, aplicarParche, cambiosEntre, esquemaParchePerfil, perfilBase, simularPerfil, tarjetaDelPerfil, vistaDelPerfil } from "./motor";

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

describe("montos por período (80.000 cada 3 meses)", () => {
  it("aMensual: determinístico, redondeado al peso más cercano (medio peso para arriba)", () => {
    expect(aMensual(80_000, "trimestral")).toEqual({ ok: true, mensual: 26_667 });
    expect(aMensual(100_000, "trimestral")).toEqual({ ok: true, mensual: 33_333 });
    expect(aMensual(90_000, "mensual")).toEqual({ ok: true, mensual: 90_000 });
    expect(aMensual(50_000, "bimestral")).toEqual({ ok: true, mensual: 25_000 });
    expect(aMensual(100_000, "cuatrimestral")).toEqual({ ok: true, mensual: 25_000 });
    expect(aMensual(600_000, "semestral")).toEqual({ ok: true, mensual: 100_000 });
    expect(aMensual(1_000_000, "anual")).toEqual({ ok: true, mensual: 83_333 });
    expect(aMensual(18, "anual")).toEqual({ ok: true, mensual: 2 }); // 1,5 → 2
    expect(aMensual(10_000, "semanal")).toEqual({ ok: true, mensual: 43_333 }); // 52 semanas / 12 meses
    expect(aMensual(1_200_000, "unica_vez", 24)).toEqual({ ok: true, mensual: 50_000 });
  });
  it("aMensual: una vez sin meses, o con 0, es un error claro (no se adivina)", () => {
    expect(aMensual(1_200_000, "unica_vez")).toMatchObject({ ok: false });
    expect(aMensual(1_200_000, "unica_vez", 0)).toMatchObject({ ok: false });
  });

  it("el esquema acepta el monto con su período, y sigue aceptando el monto mensual", () => {
    expect(esquemaParchePerfil.safeParse({ ahorro: "30000" }).success).toBe(true);
    expect(esquemaParchePerfil.safeParse({ ahorro: { monto: "360000", periodo: "anual" } }).success).toBe(true);
    expect(
      esquemaParchePerfil.safeParse({ gastosPersonales: [{ grupoId: "other", itemId: "pets", monto: { monto: "80000", periodo: "trimestral" } }] }).success,
    ).toBe(true);
    expect(esquemaParchePerfil.safeParse({ ahorro: { monto: "$80.000", periodo: "trimestral" } }).success).toBe(false);
    expect(esquemaParchePerfil.safeParse({ ahorro: { monto: "80000", periodo: "cada tanto" } }).success).toBe(false);
  });

  it("aplicarParche guarda el mensual y explica la cuenta: «80.000 cada 3 meses = 26.667 por mes»", () => {
    const r = aplicarParche(perfilBase(null), {
      gastosPersonales: [
        { grupoId: "other", itemId: "pets", monto: { monto: "80000", periodo: "trimestral" } },
        { grupoId: "other", itemId: "clothing", monto: { monto: "100000", periodo: "trimestral" } },
        { grupoId: "other", itemId: "leisure", monto: "0" },
      ],
      negocio: { software: { monto: "240000", periodo: "anual" } },
    });
    expect(r.errores).toEqual([]);
    const otros = r.perfil.personalExpenseGroups.find((g) => g.id === "other")!;
    expect(otros.items.find((i) => i.id === "pets")!.amount).toBe("26667");
    expect(otros.items.find((i) => i.id === "clothing")!.amount).toBe("33333");
    expect(r.perfil.businessSoftware).toBe("20000");
    expect(r.conversiones).toEqual([
      { etiqueta: "Mascotas", detalle: `${pesos(80_000)} cada 3 meses = ${pesos(26_667)} por mes` },
      { etiqueta: "Ropa", detalle: `${pesos(100_000)} cada 3 meses = ${pesos(33_333)} por mes` },
      { etiqueta: "Software", detalle: `${pesos(240_000)} por año = ${pesos(20_000)} por mes` },
    ]);
  });

  it("única vez repartida en N meses, y el error si faltan los meses", () => {
    const ok = aplicarParche(perfilBase(null), { equipo: { renovacionMensual: { monto: "3600000", periodo: "unica_vez", meses: "36" } } });
    expect(ok.perfil.equipmentRenewalMonthly).toBe("100000");
    expect(ok.conversiones[0]!.detalle).toBe(`${pesos(3_600_000)} por única vez, repartido en 36 meses = ${pesos(100_000)} por mes`);
    const mal = aplicarParche(perfilBase(null), { ahorro: { monto: "500000", periodo: "unica_vez" } });
    expect(mal.errores.join(" ")).toMatch(/cuántos meses/);
  });

  it("la tarjeta y la simulación muestran la conversión", () => {
    const s = simularPerfil(perfilBase(null), { gastosPersonales: [{ grupoId: "other", itemId: "pets", monto: { monto: "80000", periodo: "trimestral" } }] });
    expect(s.conversiones).toHaveLength(1);
    const t = tarjetaDelPerfil(s);
    expect(t.filas).toContainEqual({ etiqueta: "Mascotas", valor: `${pesos(80_000)} cada 3 meses = ${pesos(26_667)} por mes` });
  });
});

describe("impuestos, cobros y recargos (parche `cobros`, etapa A)", () => {
  it("aplica cada dato al bloque pricingExtras sin tocar lo demás", () => {
    const r = aplicarParche(completo(), {
      cobros: {
        monotributo: "60000",
        seguroEquipoAnual: "240000",
        condicionIva: "monotributo",
        ingresosBrutos: "3,5",
        comisionMedioDePago: "6",
        sena: "30",
        recargoSabado: "10",
        recargoDomingo: "15",
        recargoFeriado: "20",
        recargoExpres: "10",
        diasDeEntrega: "30",
        recargoHoraExtra: "50",
        viaticos: "por_km",
        valorKm: "300",
        kmSinCargo: "20",
        minutosRetoquePorFoto: "6",
        inflacionMensual: "2",
        precioMinimo: "800000",
        politicaCancelacion: "La seña no se devuelve.",
      },
    });
    expect(r.errores).toEqual([]);
    expect(r.perfil.pricingExtras).toMatchObject({
      monotributoMonthly: "60000",
      equipmentInsuranceAnnual: "240000",
      ivaCondition: "monotributo",
      grossIncomePercent: "3,5",
      paymentCommissionPercent: "6",
      includeCommissionInPrice: true,
      depositPercent: "30",
      sundaySurchargePercent: "15",
      travelMode: "per_km",
      travelPerKm: "300",
      inflationEnabled: true,
      inflationMonthlyPercent: "2",
      minimumJobPrice: "800000",
      cancellationPolicy: "La seña no se devuelve.",
    });
    expect(r.perfil.personalExpenseGroups).toEqual(completo().personalExpenseGroups);
  });

  it("zonas de viáticos e inflación en 0 la apaga", () => {
    const r = aplicarParche(completo(), {
      cobros: { viaticos: "por_zonas", zonas: [{ nombre: "Rosario", hastaKm: "15", monto: "0" }, { nombre: "Gran Rosario", hastaKm: "40", monto: "25000" }], inflacionMensual: "0" },
    });
    expect(r.perfil.pricingExtras?.travelMode).toBe("zones");
    expect(r.perfil.pricingExtras?.travelZones.map((z) => z.name)).toEqual(["Rosario", "Gran Rosario"]);
    expect(r.perfil.pricingExtras?.inflationEnabled).toBe(false);
  });

  it("un porcentaje imposible es un error y no se guarda", () => {
    const r = aplicarParche(completo(), { cobros: { comisionMedioDePago: "150" } });
    expect(r.errores.join(" ")).toMatch(/Comisión del medio de pago/);
  });

  it("cambiosEntre los nombra", () => {
    const antes = completo();
    const despues = aplicarParche(antes, { cobros: { sena: "30", ingresosBrutos: "3" } }).perfil;
    expect(cambiosEntre(antes, despues).map((c) => c.etiqueta)).toEqual(expect.arrayContaining(["Seña (%)", "Ingresos Brutos (%)"]));
  });

  it("un perfil sin cobros no muestra cambios de cobros", () => {
    expect(cambiosEntre(completo(), completo())).toEqual([]);
  });
});
