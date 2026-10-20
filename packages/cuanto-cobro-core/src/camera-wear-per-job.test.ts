/**
 * Cámara por trabajo (aprobado por Daniel, 15/10/2026).
 * - La inversión mensual en equipo queda en el valor hora y una cámara cargada nunca la reemplaza.
 * - La cámara principal no está en el valor hora: su desgaste se cobra en cada trabajo
 *   (disparos estimados × valor de reposición / vida útil del obturador), como costo directo.
 * - "legacy-structural" reproduce el modelo anterior para presupuestos guardados.
 */
import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "./calculate-cuanto-cobro";
import { analyzeCameraWear } from "./camera-equipment";
import { buildRenewalCategoryCards, computeEquipmentSavings } from "./equipment/calculations";
import { getProfileCostHour } from "./hourly-rates";
import { createBaseCompleteProfile, createBaseCompleteQuote, createOwnServiceConcept } from "./__fixtures__/characterization-fixtures";
import type { CuantoCobroQuoteInput } from "./types";

const SIN_CAMARA = createBaseCompleteProfile({ equipmentRenewalMonthly: "41667" });
const CON_CAMARA = createBaseCompleteProfile({
  equipmentRenewalMonthly: "41667",
  primaryCameraPresetId: "custom",
  primaryCameraCustomName: "Sony A7C",
  primaryCameraReplacementValue: "3000000",
  primaryCameraShutterRating: "200000",
});

function xv(disparos: string, extra: Partial<CuantoCobroQuoteInput> = {}): CuantoCobroQuoteInput {
  return createBaseCompleteQuote({
    concepts: [
      createOwnServiceConcept({ coverageHours: "10", editingHours: "8", travelHours: "1", deliveryHours: "0", directCost: "0", estimatedShots: disparos }),
    ],
    ...extra,
  });
}

function completo(r: ReturnType<typeof calculateCuantoCobro>) {
  if (r.status !== "complete") throw new Error(r.missingFields.join(", "));
  return r;
}

describe("inversión en equipo y cámara: dos cosas distintas", () => {
  it("cargar la cámara no cambia la inversión mensual en equipo ni el valor hora", () => {
    expect(computeEquipmentSavings(CON_CAMARA).renewalMonthly).toBe(41_667);
    expect(getProfileCostHour(CON_CAMARA)).toBe(getProfileCostHour(SIN_CAMARA));
    const r = completo(calculateCuantoCobro(CON_CAMARA, xv("3000")));
    expect(r.equipmentSavings.renewalMonthly).toBe(41_667);
    expect(r.monthlyNeed).toBe(completo(calculateCuantoCobro(SIN_CAMARA, xv("3000"))).monthlyNeed);
  });

  it("antes (modelo anterior) la cámara reemplazaba la inversión: 50.000 en vez de 41.667", () => {
    expect(computeEquipmentSavings(CON_CAMARA, "legacy-structural").renewalMonthly).toBe(50_000);
  });

  it("la tarjeta de la cámara en el inventario ya no aporta por mes", () => {
    const conInventario = createBaseCompleteProfile({
      equipmentInventory: {
        renewal: {
          camera: { presetId: "custom", customName: "Sony A7C", shutterRating: "200000", currentShutterCount: "", replacementValue: "3000000", resaleValue: "", estimatedAnnualShots: "" },
          lenses: [], memoryCards: null, computer: null, monitor: null, storageDisks: null, speedlight: null, studioFlash: null, aaBatteries: null,
        },
        futureEquipment: [],
      },
    });
    expect(buildRenewalCategoryCards(conInventario).find((c) => c.id === "camera")!.monthlyContribution).toBeNull();
  });

  it("CLF copiaba la renovación de la cámara en el monto mensual: ese monto no se cuenta (no se cobra dos veces)", () => {
    const camara = { presetId: "custom", customName: "Sony A7C", shutterRating: "200000", currentShutterCount: "", replacementValue: "3000000", resaleValue: "", estimatedAnnualShots: "" };
    const vacio = { lenses: [], memoryCards: null, computer: null, monitor: null, storageDisks: null, speedlight: null, studioFlash: null, aaBatteries: null };
    const derivado = createBaseCompleteProfile({ equipmentRenewalMonthly: "50000", equipmentInventory: { renewal: { camera: camara, ...vacio }, futureEquipment: [] } });
    expect(computeEquipmentSavings(derivado).renewalMonthly).toBe(0);
    // Un monto distinto es una inversión cargada a mano: se respeta.
    const aMano = createBaseCompleteProfile({ equipmentRenewalMonthly: "41667", equipmentInventory: { renewal: { camera: camara, ...vacio }, futureEquipment: [] } });
    expect(computeEquipmentSavings(aMano).renewalMonthly).toBe(41_667);
  });
});

describe("desgaste de la cámara por trabajo", () => {
  it("Sony A7C de $3.000.000 y 200.000 disparos: $15 por disparo; 3.000 disparos suman $45.000 al costo del trabajo", () => {
    const sin = completo(calculateCuantoCobro(CON_CAMARA, xv("")));
    const con = completo(calculateCuantoCobro(CON_CAMARA, xv("3000")));
    expect(con.cameraWearSummary).toMatchObject({ mode: "per-job", costPerShot: 15, totalJobShots: 3000, totalCameraWearInformative: 45_000, totalCameraWearCharged: 45_000 });
    expect(con.variableCosts - sin.variableCosts).toBe(45_000);
    expect(con.minimumPrice - sin.minimumPrice).toBeCloseTo(45_000, 6); // costo base: sin margen
    // Precio sugerido del concepto: el margen deseado (20 %) se aplica también al desgaste.
    expect(con.quoteSummary.totalSuggestedPrice - sin.quoteSummary.totalSuggestedPrice).toBeCloseTo(45_000 * 1.2, 6);
    expect(con.recommendedBusinessPrice).toBeGreaterThan(sin.recommendedBusinessPrice);
    expect(con.warnings.join(" ")).not.toMatch(/estructural|modelo anterior/i);
    expect(analyzeCameraWear(CON_CAMARA, xv("3000"))).toMatchObject({ depreciationMode: "per-job", jobWearCostCharged: 45_000 });
  });

  it("se trata como cualquier costo directo: mismo precio que cargar $45.000 de costo directo", () => {
    const desgaste = completo(calculateCuantoCobro(CON_CAMARA, xv("3000")));
    const directo = completo(
      calculateCuantoCobro(
        SIN_CAMARA,
        createBaseCompleteQuote({
          concepts: [createOwnServiceConcept({ coverageHours: "10", editingHours: "8", travelHours: "1", deliveryHours: "0", directCost: "45000" })],
        }),
      ),
    );
    expect(desgaste.minimumPrice).toBeCloseTo(directo.minimumPrice, 6);
    expect(desgaste.recommendedBusinessPrice).toBeCloseTo(directo.recommendedBusinessPrice, 6);
  });

  it("con cámara y sin disparos, no se suma nada (el trabajo no dice cuántos)", () => {
    const r = completo(calculateCuantoCobro(CON_CAMARA, xv("")));
    expect(r.cameraWearSummary).toMatchObject({ isCameraConfigured: true, totalJobShots: 0, totalCameraWearCharged: 0 });
  });

  it("disparos sin cámara configurada: no se suma y avisa como antes", () => {
    const r = completo(calculateCuantoCobro(SIN_CAMARA, xv("3000")));
    expect(r.cameraWearSummary.totalCameraWearCharged).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/cámara principal no tiene valor de reposición/);
  });
});

describe("presupuestos guardados con el modelo anterior (legacy-structural)", () => {
  it("dan exactamente lo de antes: cámara en la renovación mensual y desgaste informativo", () => {
    const r = completo(calculateCuantoCobro(CON_CAMARA, xv("3000", { cameraWearModel: "legacy-structural" })));
    expect(r.equipmentSavings.renewalMonthly).toBe(50_000);
    expect(r.cameraWearSummary).toMatchObject({ mode: "structural", totalCameraWearInformative: 45_000, totalCameraWearCharged: 0 });
    expect(r.variableCosts).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/modelo anterior/);
  });

  it("sin cámara, los dos modelos dan lo mismo", () => {
    const nuevo = completo(calculateCuantoCobro(SIN_CAMARA, xv("")));
    const viejo = completo(calculateCuantoCobro(SIN_CAMARA, xv("", { cameraWearModel: "legacy-structural" })));
    expect(nuevo.recommendedBusinessPrice).toBe(viejo.recommendedBusinessPrice);
    expect(nuevo.monthlyNeed).toBe(viejo.monthlyNeed);
  });
});
