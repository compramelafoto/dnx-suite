import { describe, expect, it } from "vitest";
import {
  packCanKeepAddingPhotos,
  resolveKeepsAddingPhotos,
} from "./keeps-adding-photos-rules";

const allMine = "@packQty:ALL_MY_PHOTOS\nTodas tus fotos";

describe("packCanKeepAddingPhotos", () => {
  it("acepta «Todas mis fotos» digital", () => {
    expect(packCanKeepAddingPhotos({ description: allMine, packType: "DIGITAL" })).toBe(true);
  });
  it("rechaza packs con impresiones", () => {
    expect(packCanKeepAddingPhotos({ description: allMine, packType: "PRINT" })).toBe(false);
  });
  it("rechaza packs mixtos con un componente de impresión", () => {
    expect(
      packCanKeepAddingPhotos({
        description: allMine,
        packType: "DIGITAL",
        componentKinds: ["DIGITAL", "PRINT"],
      })
    ).toBe(false);
  });
  it("rechaza «Todas las fotos» y packs de cantidad fija", () => {
    expect(
      packCanKeepAddingPhotos({ description: "@packQty:ALL_EVENT_PHOTOS", packType: "DIGITAL" })
    ).toBe(false);
    expect(packCanKeepAddingPhotos({ description: "5 fotos", packType: "DIGITAL" })).toBe(false);
  });
});

describe("resolveKeepsAddingPhotos", () => {
  it("devuelve error si lo piden en un pack que no lo admite", () => {
    const r = resolveKeepsAddingPhotos({
      requested: true,
      current: false,
      description: allMine,
      packType: "PRINT",
    });
    expect(r.ok).toBe(false);
  });
  it("lo apaga solo si el pack pasa a tener impresiones", () => {
    const r = resolveKeepsAddingPhotos({
      requested: undefined,
      current: true,
      description: allMine,
      packType: "PRINT",
    });
    expect(r).toEqual({ ok: true, value: false });
  });
  it("conserva el valor actual si no lo mandan", () => {
    const r = resolveKeepsAddingPhotos({
      requested: undefined,
      current: true,
      description: allMine,
      packType: "DIGITAL",
    });
    expect(r).toEqual({ ok: true, value: true });
  });
  it("permite apagarlo", () => {
    const r = resolveKeepsAddingPhotos({
      requested: false,
      current: true,
      description: allMine,
      packType: "DIGITAL",
    });
    expect(r).toEqual({ ok: true, value: false });
  });
});
