import { describe, expect, it } from "vitest";
import { INITIAL_CUANTO_COBRO_PROFILE } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile, createBaseCompleteQuote } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { MAX_PERFIL_BYTES, normalizarPerfil, perfilesIguales, validarPerfil } from "./perfil-datos";
import { entradaDelMotor, TOPE_ENTRADA_MOTOR } from "../presupuestos/calculo-cuanto-cobro";

describe("normalizarPerfil", () => {
  it("devuelve null si no es un objeto", () => {
    expect(normalizarPerfil(null)).toBeNull();
    expect(normalizarPerfil([])).toBeNull();
    expect(normalizarPerfil("hola")).toBeNull();
  });

  it("completa un objeto parcial con las claves iniciales", () => {
    const p = normalizarPerfil({ weeklyHours: "40" });
    expect(p).not.toBeNull();
    for (const clave of Object.keys(INITIAL_CUANTO_COBRO_PROFILE)) {
      expect(p).toHaveProperty(clave);
    }
    expect(p?.weeklyHours).toBe("40");
    expect(p?.currency).toBe("ARS");
  });

  it("conserva equipmentInventory", () => {
    const base = createBaseCompleteProfile();
    const p = normalizarPerfil(base);
    expect(p?.equipmentInventory).toEqual(base.equipmentInventory);
  });

  it("descarta grupos sin items y renglones sin label", () => {
    const p = normalizarPerfil({
      personalExpenseGroups: [
        { id: "a", title: "A" },
        {
          id: "b",
          title: "B",
          items: [
            { id: "1", label: "Luz", amount: "100" },
            { id: "2", amount: "50" },
          ],
        },
      ],
    });
    expect(p?.personalExpenseGroups).toHaveLength(1);
    expect(p?.personalExpenseGroups[0].items).toEqual([
      { id: "1", label: "Luz", amount: "100", isCustom: false },
    ]);
  });
});

describe("validarPerfil", () => {
  it("acepta un perfil completo", () => {
    expect(validarPerfil(createBaseCompleteProfile()).ok).toBe(true);
  });

  it("rechaza lo que no es objeto", () => {
    expect(validarPerfil(5)).toEqual({ ok: false, error: "Los datos del perfil no son válidos." });
  });

  it("acepta la distribución de un perfil real de CLF: 24 h con porcentajes que suman 101", () => {
    const p = {
      ...createBaseCompleteProfile(),
      weeklyHours: "24",
      timeDistribution: { coverage: "33", editing: "21", administration: "21", sales: "8", marketing: "13", training: "5" },
    };
    expect(validarPerfil(p).ok).toBe(true);
  });

  it("rechaza una distribución cuyas horas no cierran", () => {
    const p = {
      ...createBaseCompleteProfile(),
      weeklyHours: "24",
      timeDistribution: { coverage: "50", editing: "20", administration: "0", sales: "0", marketing: "0", training: "0" },
    };
    expect(validarPerfil(p)).toEqual({
      ok: false,
      error: "La distribución del tiempo no cierra: las horas de cada tarea tienen que sumar tus horas por semana.",
    });
  });

  it("rechaza un monto no numérico con su etiqueta", () => {
    const base = createBaseCompleteProfile();
    const grupos = structuredClone(base.personalExpenseGroups);
    grupos[0].items[0] = { ...grupos[0].items[0], label: "Internet", amount: "abc" };
    const r = validarPerfil({ ...base, personalExpenseGroups: grupos });
    expect(r).toEqual({ ok: false, error: "Revisá el monto de «Internet»." });
  });

  it("rechaza un monto de campo fijo no numérico", () => {
    const r = validarPerfil({ ...createBaseCompleteProfile(), businessRent: "xx" });
    expect(r).toEqual({ ok: false, error: "Revisá el monto de «Alquiler o estudio»." });
  });

  it("rechaza un posicionamiento fuera de la lista", () => {
    const r = validarPerfil({ ...createBaseCompleteProfile(), commercialPositioningId: "otro" });
    expect(r).toEqual({ ok: false, error: "Elegí un posicionamiento comercial." });
  });

  it("rechaza un perfil demasiado grande", () => {
    const r = validarPerfil({ ...createBaseCompleteProfile(), currency: "x".repeat(250 * 1024) });
    expect(r).toEqual({ ok: false, error: "El perfil es demasiado grande." });
  });
});

describe("perfilesIguales", () => {
  it("ignora el orden de las claves", () => {
    const a = createBaseCompleteProfile();
    const b = Object.fromEntries(Object.entries(a).reverse()) as typeof a;
    expect(perfilesIguales(a, b)).toBe(true);
  });

  it("detecta un cambio de monto", () => {
    const a = createBaseCompleteProfile();
    expect(perfilesIguales(a, { ...a, businessRent: "999999" })).toBe(false);
  });
});

describe("tope del perfil frente al motor", () => {
  it("un perfil al tope más un presupuesto típico entra en la entrada del motor", () => {
    const base = createBaseCompleteProfile();
    const relleno = "x".repeat(1000);
    const perfil = { ...base, personalExpenseGroups: [{ id: "g", title: "g", items: [] as { id: string; label: string; amount: string; isCustom: boolean }[] }] };
    let i = 0;
    while (JSON.stringify(perfil).length < MAX_PERFIL_BYTES - 1100) {
      perfil.personalExpenseGroups[0].items.push({ id: `i${i++}`, label: relleno, amount: "1", isCustom: true });
    }
    expect(JSON.stringify(perfil).length).toBeLessThanOrEqual(MAX_PERFIL_BYTES);
    expect(validarPerfil(perfil).ok).toBe(true);
    const entrada = { perfil, presupuesto: createBaseCompleteQuote() };
    expect(JSON.stringify(entrada).length).toBeLessThanOrEqual(TOPE_ENTRADA_MOTOR);
    expect(entradaDelMotor(entrada)).not.toBeNull();
  });
});

describe("distribución en horas (DNX Bot)", () => {
  it("de horas por tarea a porcentajes que el motor acepta, y de vuelta", async () => {
    const { distribucionDesdeHoras, horasPorTarea } = await import("./perfil-datos");
    const { isTimeDistributionValid } = await import("@repo/cuanto-cobro-core");
    const horas = { coverage: 10, editing: 15, administration: 7, sales: 5, marketing: 5, training: 3 };
    const d = distribucionDesdeHoras(horas, 45)!;
    expect(isTimeDistributionValid(d, 45)).toBe(true);
    expect(horasPorTarea({ weeklyHours: "45", timeDistribution: d })).toEqual(horas);
  });
  it("sin horas por semana no hay distribución; si no suman, el motor la rechaza", async () => {
    const { distribucionDesdeHoras } = await import("./perfil-datos");
    const { isTimeDistributionValid } = await import("@repo/cuanto-cobro-core");
    expect(distribucionDesdeHoras({ coverage: 10 }, 0)).toBeNull();
    const d = distribucionDesdeHoras({ coverage: 10, editing: 10 }, 45)!;
    expect(isTimeDistributionValid(d, 45)).toBe(false);
  });
});

describe("precio completo en el perfil (pricingExtras)", () => {
  it("un perfil sin el bloque no lo inventa (sigue igual que antes)", () => {
    const p = normalizarPerfil({ weeklyHours: "40" });
    expect(p && "pricingExtras" in p).toBe(false);
  });

  it("completa el bloque guardado y descarta lo que no sirve", () => {
    const p = normalizarPerfil({ pricingExtras: { grossIncomePercent: "3,5", travelZones: [{ id: "z", name: "Centro", upToKm: "10", amount: "0" }, 4], extraHolidays: ["2026-10-07", "x"] } });
    expect(p?.pricingExtras).toMatchObject({
      grossIncomePercent: "3,5",
      includeCommissionInPrice: true,
      travelZones: [{ id: "z", name: "Centro" }],
      extraHolidays: ["2026-10-07"],
      ivaCondition: "",
    });
  });

  it("valida porcentajes (0 a 100) y montos", () => {
    expect(validarPerfil({ pricingExtras: { paymentCommissionPercent: "120" } })).toEqual({ ok: false, error: "Revisá el porcentaje de «Comisión del medio de pago»." });
    expect(validarPerfil({ pricingExtras: { depositPercent: "treinta" } })).toEqual({ ok: false, error: "Revisá el porcentaje de «Seña»." });
    expect(validarPerfil({ pricingExtras: { travelPerKm: "abc" } })).toEqual({ ok: false, error: "Revisá el monto de «Valor por km»." });
    expect(validarPerfil({ pricingExtras: { travelZones: [{ id: "z", name: "", upToKm: "10", amount: "1000" }] } })).toEqual({ ok: false, error: "Cada zona de viáticos necesita un nombre." });
    expect(validarPerfil({ pricingExtras: { grossIncomePercent: "3", paymentCommissionPercent: "6", depositPercent: "30" } }).ok).toBe(true);
  });
});
