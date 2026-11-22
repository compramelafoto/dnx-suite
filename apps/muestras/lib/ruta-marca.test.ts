import { describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ notFound }));

const { sinPrefijoDeMarca, marcaDeParams } = await import("./ruta-marca");
const { MARCAS } = await import("./marca");

describe("sinPrefijoDeMarca", () => {
  it.each([
    ["/fotografia/panel/muestras", "/panel/muestras"],
    ["/arte", "/"],
    ["/arte/m/x", "/m/x"],
    ["/panel", "/panel"],
    ["/artesanos", "/artesanos"],
  ])("%s → %s", (a, b) => expect(sinPrefijoDeMarca(a)).toBe(b));
});

describe("marcaDeParams", () => {
  it.each([
    ["fotografia", MARCAS.FOTOGRAFIA],
    ["arte", MARCAS.ARTE],
  ])("%s → su marca", async (segmento, marca) => {
    await expect(marcaDeParams(Promise.resolve({ marca: segmento }))).resolves.toBe(marca);
  });

  it("un segmento desconocido llama a notFound()", async () => {
    notFound.mockClear();
    await expect(marcaDeParams(Promise.resolve({ marca: "artesanos" }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
