import { describe, expect, it } from "vitest";
import { EquipoError } from "../inventario/equipos";
import { PROVINCIAS } from "./catalogos";
import { listingBlocker, maskSerial, requiresSerial, validateListingInput } from "./reglas";

const base = { status: "IN_USE" as const, serialNormalized: null, photoKeys: ["equipos/a.jpg"] };
const ctx = { ownReportOpen: false, activeListing: false, serialPhotoKey: null };

const valido = {
  priceArs: 1500000,
  condition: "GOOD" as const,
  province: "Santa Fe",
  city: "Rafaela",
  socialConsent: true,
};

describe("catálogos", () => {
  it("tiene 24 jurisdicciones", () => {
    expect(PROVINCIAS).toHaveLength(24);
    expect(PROVINCIAS).toContain("Ciudad Autónoma de Buenos Aires");
  });
});

describe("listingBlocker", () => {
  it("pide serie y foto de la serie sólo a cámaras y lentes", () => {
    expect(listingBlocker({ ...base, kind: "LENS" }, ctx)).toBe(
      "Para cámaras y lentes el número de serie es obligatorio.",
    );
    expect(listingBlocker({ ...base, kind: "TRIPOD" }, ctx)).toBeNull();
    expect(listingBlocker({ ...base, kind: "BODY", serialNormalized: "ABC1234" }, ctx)).toBe(
      "Subí una foto del número de serie grabado en el equipo.",
    );
    expect(
      listingBlocker(
        { ...base, kind: "BODY", serialNormalized: "ABC1234" },
        { ...ctx, serialPhotoKey: "equipos/s.jpg" },
      ),
    ).toBeNull();
  });
  it("no deja publicar un equipo robado, perdido o vendido", () => {
    for (const status of ["STOLEN", "LOST", "SOLD"] as const) {
      expect(listingBlocker({ ...base, status, kind: "TRIPOD" }, ctx)).toBe(
        "Este equipo no se puede publicar en su estado actual.",
      );
    }
  });
  it("bloquea con denuncia propia abierta, publicación activa y sin fotos", () => {
    expect(listingBlocker({ ...base, kind: "TRIPOD" }, { ...ctx, ownReportOpen: true })).toBe(
      "Este equipo no se puede publicar en su estado actual.",
    );
    expect(listingBlocker({ ...base, kind: "TRIPOD" }, { ...ctx, activeListing: true })).toBe(
      "Este equipo ya tiene una publicación.",
    );
    expect(listingBlocker({ ...base, photoKeys: [], kind: "TRIPOD" }, ctx)).toBe(
      "Subí al menos una foto del equipo.",
    );
  });
  it("requiresSerial", () => {
    expect(requiresSerial("BODY")).toBe(true);
    expect(requiresSerial("LENS")).toBe(true);
    expect(requiresSerial("TRIPOD")).toBe(false);
  });
});

describe("maskSerial", () => {
  it("enmascara la serie", () => expect(maskSerial("ABC123456")).toBe("••••3456"));
  it("series cortas muestran sólo los últimos 2", () => {
    expect(maskSerial("ABCD")).toBe("••••CD");
    expect(maskSerial("ABC")).toBe("••••BC");
    expect(maskSerial("ABCDE")).toBe("••••BCDE");
  });
  it("sin serie devuelve null",() => expect(maskSerial(null)).toBeNull());
});

describe("validateListingInput", () => {
  it("acepta datos válidos y recorta textos", () => {
    const r = validateListingInput({ ...valido, city: "  Rafaela ", description: " hola " }, "BODY");
    expect(r.city).toBe("Rafaela");
    expect(r.description).toBe("hola");
  });
  it.each([
    ["precio decimal", { priceArs: 10.5 }],
    ["precio cero", { priceArs: 0 }],
    ["dólares decimales", { priceUsdRef: 1.5 }],
    ["dólares negativos", { priceUsdRef: -1 }],
    ["provincia inválida", { province: "Atlantida" }],
    ["ciudad vacía", { city: "   " }],
    ["montura inválida", { mount: "Zeta" }],
    ["sin consentimiento", { socialConsent: false }],
    ["descripción larga", { description: "a".repeat(2001) }],
    ["accesorios largos", { accessories: "a".repeat(501) }],
    ["baterías fuera de rango", { batteriesCount: 11 }],
    ["baterías decimales", { batteriesCount: 1.5 }],
    ["baterías negativas", { batteriesCount: -1 }],
  ])("rechaza %s", (_n, over) => {
    expect(() => validateListingInput({ ...valido, ...over }, "BODY")).toThrow(EquipoError);
  });
  it("mensaje de consentimiento", () => {
    expect(() => validateListingInput({ ...valido, socialConsent: false }, "BODY")).toThrow(
      "Para publicar tenés que aceptar que el artículo pueda salir en las redes del portal.",
    );
  });
});
