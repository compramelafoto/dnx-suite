import { describe, expect, it } from "vitest";
import { sinPrefijoDeMarca } from "./ruta-marca";

describe("sinPrefijoDeMarca", () => {
  it.each([
    ["/fotografia/panel/muestras", "/panel/muestras"],
    ["/arte", "/"],
    ["/arte/m/x", "/m/x"],
    ["/panel", "/panel"],
    ["/artesanos", "/artesanos"],
  ])("%s → %s", (a, b) => expect(sinPrefijoDeMarca(a)).toBe(b));
});
