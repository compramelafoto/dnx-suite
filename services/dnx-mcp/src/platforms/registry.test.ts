import { describe, expect, it } from "vitest";
import {
  getPlatform,
  getPlatformOrThrow,
  listPlatforms,
  validatePlatform,
  comprameLaFotoPlatform,
  fotorankPlatform,
} from "./index.js";

describe("platform registry", () => {
  it("lista todas las plataformas DNX", () => {
    const platforms = listPlatforms();
    expect(platforms.length).toBe(5);
    expect(platforms.map((p) => p.id).sort()).toEqual([
      "camofduty",
      "compramelafoto",
      "cuantocobro",
      "fotooffice",
      "fotorank",
    ]);
  });

  it("obtiene plataforma por id", () => {
    const platform = getPlatform("compramelafoto");
    expect(platform?.name).toBe("ComprameLaFoto");
    expect(platform?.vercelProject).toBe("compramelafoto-dnxsuite");
  });

  it("lanza error si plataforma no existe", () => {
    expect(() => getPlatformOrThrow("unknown")).toThrow("Plataforma no encontrada");
  });

  it("valida plataforma registrada por id", () => {
    const result = validatePlatform("fotorank");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("valida definición de plataforma directamente", () => {
    const result = validatePlatform(comprameLaFotoPlatform);
    expect(result.valid).toBe(true);
  });

  it("rechaza plataforma inválida", () => {
    const invalid = { ...fotorankPlatform, id: "INVALID ID" };
    const result = validatePlatform(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rechota id no registrado", () => {
    const result = validatePlatform("nonexistent");
    expect(result.valid).toBe(false);
  });
});
