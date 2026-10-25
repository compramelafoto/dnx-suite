/**
 * Varias cámaras (16/10/2026). Caso de Daniel: el carnet son 3 disparos en OTRA cámara, de $500.000 con
 * 150.000 disparos de vida útil → $10 de desgaste por carnet. La principal sigue siendo la #1.
 */
import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "./calculate-cuanto-cobro";
import { normalizeCameras, PRIMARY_CAMERA_ID, resolveProfileCameras } from "./cameras";
import { createQuoteItemFromPreset } from "./quote-items";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
  createOwnServiceConcept,
  withConfiguredCamera,
} from "./__fixtures__/characterization-fixtures";
import type { CuantoCobroProfileInput, CuantoCobroQuoteItem } from "./types";

function completo(r: ReturnType<typeof calculateCuantoCobro>) {
  if (r.status !== "complete") throw new Error(r.missingFields.join(", "));
  return r;
}

const CARNETERA = { id: "cam-2", name: "Cámara de carnets", presetId: "custom", shutterRating: "150000", currentShutterCount: "", replacementValue: "500000" };

const PERFIL: CuantoCobroProfileInput = {
  ...createBaseCompleteProfile({
    primaryCameraPresetId: "custom",
    primaryCameraCustomName: "Sony A7C",
    primaryCameraReplacementValue: "3000000",
    primaryCameraShutterRating: "200000",
  }),
  cameras: [CARNETERA],
};

function carnet(cantidad: string, extra: Partial<CuantoCobroQuoteItem> = {}): CuantoCobroQuoteItem {
  return {
    ...createQuoteItemFromPreset("Carnet", "physical-product"),
    quantity: cantidad,
    supplierCost: "300",
    desiredMarginPercent: "0",
    estimatedShots: "3",
    cameraId: "cam-2",
    ...extra,
  };
}

function conConceptos(...concepts: CuantoCobroQuoteItem[]) {
  return createBaseCompleteQuote({ concepts });
}

describe("varias cámaras", () => {
  it("la principal es la #1 y las demás vienen después", () => {
    const cams = resolveProfileCameras(PERFIL);
    expect(cams.map((c) => c.id)).toEqual([PRIMARY_CAMERA_ID, "cam-2"]);
    expect(cams[0]!.costPerShot).toBe(15);
    expect(cams[1]!.costPerShot).toBeCloseTo(500_000 / 150_000, 10);
  });

  it("carnet: 3 disparos en la cámara 2 = $10 por carnet, por unidad", () => {
    const uno = completo(calculateCuantoCobro(PERFIL, conConceptos(carnet("1")))).quoteSummary.items[0]!;
    expect(uno.cameraWearCharged).toBe(10);
    expect(uno.directCost).toBe(310);
    const diez = completo(calculateCuantoCobro(PERFIL, conConceptos(carnet("10")))).quoteSummary.items[0]!;
    expect(diez.cameraWearCharged).toBe(100);
  });

  it("disparos por trabajo: no se multiplican por la cantidad", () => {
    const r = completo(calculateCuantoCobro(PERFIL, conConceptos(carnet("10", { shotsPer: "job", estimatedShots: "30" }))));
    expect(r.quoteSummary.items[0]!.cameraWearCharged).toBe(100);
  });

  it("los disparos en otra cámara no gastan el obturador de la principal", () => {
    const r = completo(
      calculateCuantoCobro(PERFIL, conConceptos(createOwnServiceConcept({ estimatedShots: "1000" }), carnet("10"))),
    );
    expect(r.cameraWear?.jobShots).toBe(1000);
    expect(r.quoteSummary.items[0]!.cameraWearCharged).toBe(15_000);
  });

  it("un servicio propio puede usar otra cámara", () => {
    const r = completo(calculateCuantoCobro(PERFIL, conConceptos(createOwnServiceConcept({ estimatedShots: "300", cameraId: "cam-2" }))));
    expect(r.quoteSummary.items[0]!.cameraWearCharged).toBe(1000);
  });

  it("cámara que ya no está: sin desgaste y con aviso", () => {
    const r = completo(calculateCuantoCobro(PERFIL, conConceptos(carnet("1", { cameraId: "cam-borrada" }))));
    expect(r.quoteSummary.items[0]!.cameraWearCharged).toBe(0);
    expect(r.warnings.join(" ")).toContain("ya no está en tu perfil");
  });

  it("cámara sin valor de reposición: sin desgaste y con aviso", () => {
    const perfil = { ...PERFIL, cameras: [{ ...CARNETERA, replacementValue: "" }] };
    const r = completo(calculateCuantoCobro(perfil, conConceptos(carnet("1"))));
    expect(r.quoteSummary.items[0]!.cameraWearCharged).toBe(0);
    expect(r.warnings.join(" ")).toContain("no tiene valor de reposición");
  });

  it("compatibilidad: un producto con disparos pero sin cámara elegida no suma desgaste (como antes)", () => {
    const antes = completo(calculateCuantoCobro(withConfiguredCamera(createBaseCompleteProfile()), conConceptos(carnet("1", { cameraId: undefined }))));
    expect(antes.quoteSummary.items[0]!.cameraWearCharged).toBe(0);
  });

  it("compatibilidad: un perfil sin `cameras` calcula igual que antes", () => {
    const perfil = withConfiguredCamera(createBaseCompleteProfile());
    const trabajo = conConceptos(createOwnServiceConcept({ estimatedShots: "2000" }));
    expect(calculateCuantoCobro({ ...perfil, cameras: [] }, trabajo)).toEqual(calculateCuantoCobro(perfil, trabajo));
  });

  it("normalizeCameras: sin ids repetidos ni el reservado", () => {
    expect(normalizeCameras([{ id: "primary" }, { id: "a", name: "A" }, { id: "a" }, "x", { name: "sin id" }]).map((c) => c.id)).toEqual(["a"]);
    expect(normalizeCameras("x")).toEqual([]);
  });
});
