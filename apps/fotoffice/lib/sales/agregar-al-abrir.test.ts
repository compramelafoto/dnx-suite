import { describe, expect, it } from "vitest";
import { enlaceAgregarAlAbrir, leerAgregarAlAbrir } from "./agregar-al-abrir";

describe("productos que llegan al Mostrador por la dirección", () => {
  it("ida y vuelta", () => {
    const r = [
      { sku: "POL-MAN-75x10-50", cantidad: 55 },
      { sku: "POL-INS-9x13", cantidad: 2 },
    ];
    const url = new URL(enlaceAgregarAlAbrir(r), "https://fotoffice.com");
    expect(leerAgregarAlAbrir(url.searchParams.get("agregar") ?? undefined)).toEqual(r);
  });

  it("descarta lo que no se entiende, sin romper", () => {
    expect(leerAgregarAlAbrir(undefined)).toEqual([]);
    expect(leerAgregarAlAbrir("A*0,B*-1,C*2.5,<x>*1,D*abc,E*3")).toEqual([{ sku: "E", cantidad: 3 }]);
  });
});
