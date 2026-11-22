import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { entrantsHash, orderEntrants, publicName } from "./padron";
import { hashDeCodigos } from "./verification";

describe("el padrón", () => {
  it("ordena por número de cuenta, sin repetir, y numera desde 0", () => {
    const p = orderEntrants([
      { userId: 30, displayName: "C", salesCount: 1 },
      { userId: 4, displayName: "A", salesCount: 2 },
      { userId: 30, displayName: "C otra vez", salesCount: 9 },
      { userId: 12, displayName: "B", salesCount: 1 },
    ]);
    expect(p.map((e) => [e.position, e.code])).toEqual([
      [0, "4"],
      [1, "12"],
      [2, "30"],
    ]);
  });

  it("la huella es la fórmula publicada, recalculable por cualquiera", () => {
    const lista = [
      { position: 0, code: "4" },
      { position: 1, code: "12" },
    ];
    const esperada = createHash("sha256").update("clf-raffle-v1\nraf1\n0:4\n1:12", "utf8").digest("hex");
    expect(entrantsHash("raf1", lista)).toBe(esperada);
  });

  it("la verificación (implementación aparte) da la misma huella", () => {
    const lista = orderEntrants([
      { userId: 7, displayName: "X", salesCount: 1 },
      { userId: 3, displayName: "Y", salesCount: 1 },
    ]);
    expect(hashDeCodigos("r", lista)).toBe(entrantsHash("r", lista));
  });

  it("cambiar el nombre no cambia la huella; cambiar quién está, sí", () => {
    const a = [{ position: 0, code: "4" }];
    expect(entrantsHash("r", a)).toBe(entrantsHash("r", [{ position: 0, code: "4" }]));
    expect(entrantsHash("r", a)).not.toBe(entrantsHash("r", [{ position: 0, code: "5" }]));
  });
});

describe("el nombre público", () => {
  it("nombre e inicial del apellido", () => {
    expect(publicName({ name: "Juana María Pérez" })).toBe("Juana María P.");
  });
  it("sin nombre, el estudio", () => {
    expect(publicName({ name: "  ", companyName: "Estudio Luz" })).toBe("Estudio Luz");
  });
  it("sin nada, genérico", () => {
    expect(publicName({})).toBe("Fotógrafo");
  });
});
