import { describe, expect, it } from "vitest";
import { computeTrust, declaredItems, usageSealText } from "./confianza";

const checkedAt = new Date("2026-11-27T15:00:00Z");
const BASE = [
  "Identidad del vendedor verificada",
  "Sin denuncias de robo ni pérdida en el portal (revisado el 27/11/2026)",
];

describe("computeTrust", () => {
  it("uso verificado + factura = 5, Alto", () => {
    const r = computeTrust({ usageSeal: "USAGE_VERIFIED", hasPurchaseProof: true, shutterVerified: false, checkedAt });
    expect(r.points).toBe(5);
    expect(r.level).toBe("ALTO");
    expect(r.verified).toEqual([
      ...BASE,
      "Uso verificado en CompraMeLaFoto",
      "Factura de compra presentada",
    ]);
  });
  it("foto de la serie sin factura = 2, Bueno", () => {
    const r = computeTrust({ usageSeal: "PROOF_PHOTO", hasPurchaseProof: false, shutterVerified: false, checkedAt });
    expect(r).toMatchObject({ points: 2, level: "BUENO" });
    expect(r.verified).toEqual([...BASE, "Serie comprobada con foto del equipo"]);
  });
  it("nada = 0, Básico", () => {
    expect(computeTrust({ usageSeal: "NONE", hasPurchaseProof: false, shutterVerified: false, checkedAt })).toEqual({
      points: 0,
      level: "BASICO",
      verified: BASE,
    });
  });
  it("máximo con todo", () => {
    const r = computeTrust({ usageSeal: "USAGE_VERIFIED", hasPurchaseProof: true, shutterVerified: true });
    expect(r.points).toBe(7);
    expect(r.level).toBe("MAXIMO");
    expect(r.verified).toHaveLength(5);
  });
  it("cortes", () => {
    const t = (u: "USAGE_VERIFIED" | "PROOF_PHOTO" | "NONE", f: boolean, s: boolean) =>
      computeTrust({ usageSeal: u, hasPurchaseProof: f, shutterVerified: s });
    expect(t("NONE", false, false).level).toBe("BASICO");
    expect(t("NONE", true, false).level).toBe("BUENO"); // 2
    expect(t("USAGE_VERIFIED", false, false).level).toBe("BUENO"); // 3
    expect(t("PROOF_PHOTO", true, false).level).toBe("ALTO"); // 4
    expect(t("PROOF_PHOTO", true, true).level).toBe("MAXIMO"); // 6
  });
});

describe("declaredItems", () => {
  it("lista lo declarado", () => {
    expect(
      declaredItems({
        declaredFirstOwner: true,
        includesCharger: true,
        batteriesCount: 2,
        includesManual: true,
        includesBox: false,
      }),
    ).toEqual(["Primer dueño", "Incluye cargador", "2 baterías", "Incluye manual"]);
  });
  it("singular y caja", () => {
    expect(
      declaredItems({
        declaredFirstOwner: false,
        includesCharger: false,
        batteriesCount: 1,
        includesManual: false,
        includesBox: true,
      }),
    ).toEqual(["1 batería", "Incluye caja original"]);
  });
  it("cero baterías no se muestra", () => {
    expect(
      declaredItems({
        declaredFirstOwner: false,
        includesCharger: false,
        batteriesCount: 0,
        includesManual: false,
        includesBox: false,
      }),
    ).toEqual([]);
  });
});

describe("usageSealText", () => {
  it("uso verificado", () =>
    expect(usageSealText("USAGE_VERIFIED", new Date("2024-11-02T12:00:00-03:00"), 52)).toBe(
      "Usado por el vendedor desde noviembre de 2024, en 52 fotos",
    ));
  it("foto de la serie", () =>
    expect(usageSealText("PROOF_PHOTO", null, null)).toBe("Serie comprobada con foto del equipo"));
  it("ninguno", () => expect(usageSealText("NONE", null, null)).toBeNull());
});
