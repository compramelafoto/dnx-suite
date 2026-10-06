import { describe, expect, it } from "vitest";
import {
  archivedName,
  editableModuleKeys,
  isCurrentOrUpcoming,
  isUniqueViolation,
  personLabel,
  nextCopyName,
  reorderOffices,
} from "./rules";

const NOW = new Date("2026-10-03T15:00:00.000Z");

describe("isCurrentOrUpcoming", () => {
  it("vigente, futura y sin vencimiento cuentan; revocada o vencida no", () => {
    expect(isCurrentOrUpcoming({ startsAt: null, endsAt: null, revokedAt: null }, NOW)).toBe(true);
    expect(
      isCurrentOrUpcoming({ startsAt: new Date("2027-01-01"), endsAt: null, revokedAt: null }, NOW),
    ).toBe(true);
    expect(isCurrentOrUpcoming({ startsAt: null, endsAt: null, revokedAt: NOW }, NOW)).toBe(false);
    expect(
      isCurrentOrUpcoming({ startsAt: null, endsAt: new Date("2026-10-01"), revokedAt: null }, NOW),
    ).toBe(false);
  });
});

describe("nextCopyName", () => {
  it("usa (copia), después (copia 2), (copia 3)…", () => {
    expect(nextCopyName("Tesorería", ["Tesorería"])).toBe("Tesorería (copia)");
    expect(nextCopyName("Tesorería", ["Tesorería", "Tesorería (copia)"])).toBe("Tesorería (copia 2)");
    expect(
      nextCopyName("Tesorería", ["Tesorería", "Tesorería (copia)", "tesorería (copia 2)"]),
    ).toBe("Tesorería (copia 3)");
  });
});

describe("archivedName", () => {
  it("agrega la fecha argentina dd/mm/aaaa", () => {
    // 02:00 UTC del 4/10 es todavía 3/10 en Argentina.
    expect(archivedName("Prensa", new Date("2026-10-04T02:00:00.000Z"), [])).toBe(
      "Prensa (archivado 03/10/2026)",
    );
  });

  it("si ya hay uno archivado ese día con el mismo nombre, numera", () => {
    expect(archivedName("Prensa", NOW, ["Prensa (archivado 03/10/2026)"])).toBe(
      "Prensa (archivado 03/10/2026, 2)",
    );
  });
});

describe("reorderOffices", () => {
  const list = [
    { id: "a", order: 0 },
    { id: "b", order: 5 },
    { id: "c", order: 5 },
  ];

  it("subir intercambia con el anterior y normaliza el orden", () => {
    expect(reorderOffices(list, "b", "up")).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
  });

  it("bajar intercambia con el siguiente", () => {
    expect(reorderOffices(list, "a", "down")).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
  });

  it("en el borde o con id desconocido devuelve null", () => {
    expect(reorderOffices(list, "a", "up")).toBeNull();
    expect(reorderOffices(list, "c", "down")).toBeNull();
    expect(reorderOffices(list, "z", "up")).toBeNull();
  });
});

describe("editableModuleKeys", () => {
  it("sólo los disponibles que están habilitados (con el alias de Cuotas)", () => {
    const available = ["members", "membership-dues", "bookings", "cash"];
    expect(editableModuleKeys(available, new Set(["members", "cash"]))).toEqual([
      "members",
      "membership-dues",
      "cash",
    ]);
  });
});

describe("personLabel / isUniqueViolation", () => {
  it("la ficha manda sobre la cuenta", () => {
    expect(personLabel("m1", 7)).toBe("m:m1");
    expect(personLabel(null, 7)).toBe("u:7");
    expect(personLabel(null, null)).toBe("");
  });

  it("reconoce P2002 y nada más", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});
