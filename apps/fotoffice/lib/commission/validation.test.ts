import { describe, expect, it } from "vitest";
import { parseOfficeForm, parsePermissionGrid, parseRoleForm, parseTermDates } from "./validation";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("parseRoleForm", () => {
  it("recorta espacios y acepta un nombre válido", () => {
    expect(parseRoleForm(fd({ name: "  Tesorería  ", description: " Cobra " }))).toEqual({
      ok: true,
      name: "Tesorería",
      description: "Cobra",
    });
  });
  it("descripción vacía es null", () => {
    expect(parseRoleForm(fd({ name: "Tesorería", description: "  " }))).toEqual({
      ok: true,
      name: "Tesorería",
      description: null,
    });
  });
  it("rechaza nombre corto", () => {
    expect(parseRoleForm(fd({ name: " a " })).ok).toBe(false);
  });
  it("rechaza nombre de más de 60", () => {
    expect(parseRoleForm(fd({ name: "a".repeat(61) })).ok).toBe(false);
    expect(parseRoleForm(fd({ name: "a".repeat(60) })).ok).toBe(true);
  });
  it("rechaza descripción de más de 200", () => {
    expect(parseRoleForm(fd({ name: "Rol", description: "a".repeat(201) })).ok).toBe(false);
    expect(parseRoleForm(fd({ name: "Rol", description: "a".repeat(200) })).ok).toBe(true);
  });
});

describe("parsePermissionGrid", () => {
  const keys = ["members", "charges"] as const;
  it("lee nivel y acciones con MANAGE", () => {
    const r = parsePermissionGrid(
      fd({ "level:members": "MANAGE", "action:members:export": "on", "action:members:delete": "on" }),
      keys,
    );
    expect(r).toContainEqual({ moduleKey: "members", level: "MANAGE", actions: ["export", "delete"] });
  });
  it("descarta acciones si el nivel es VIEW", () => {
    const r = parsePermissionGrid(fd({ "level:members": "VIEW", "action:members:export": "on" }), keys);
    expect(r.find((x) => x.moduleKey === "members")).toEqual({ moduleKey: "members", level: "VIEW", actions: [] });
  });
  it("ignora módulos no editables", () => {
    const r = parsePermissionGrid(fd({ "level:secret": "MANAGE", "action:secret:x": "on" }), keys);
    expect(r.map((x) => x.moduleKey)).toEqual(["members", "charges"]);
  });
  it("valor desconocido o ausente es NONE", () => {
    const r = parsePermissionGrid(fd({ "level:members": "ADMIN" }), keys);
    expect(r).toEqual([
      { moduleKey: "members", level: "NONE", actions: [] },
      { moduleKey: "charges", level: "NONE", actions: [] },
    ]);
  });
});

describe("parseOfficeForm", () => {
  it("lee nombre y casilla de voto", () => {
    expect(parseOfficeForm(fd({ name: " Presidente ", votes: "on" }))).toEqual({
      ok: true,
      name: "Presidente",
      votes: true,
    });
  });
  it("sin casilla no vota", () => {
    expect(parseOfficeForm(fd({ name: "Vocal" }))).toEqual({ ok: true, name: "Vocal", votes: false });
  });
  it("rechaza nombres fuera de 2–60", () => {
    expect(parseOfficeForm(fd({ name: "x" })).ok).toBe(false);
    expect(parseOfficeForm(fd({ name: "x".repeat(61) })).ok).toBe(false);
  });
});

describe("parseTermDates", () => {
  it("vacíos son null", () => {
    expect(parseTermDates(fd({ startsAt: "", endsAt: "" }))).toEqual({ ok: true, startsAt: null, endsAt: null });
  });
  it("inicio es 00:00 argentina", () => {
    const r = parseTermDates(fd({ startsAt: "2026-01-01" }));
    expect(r.ok && r.startsAt?.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });
  it("fin es 23:59:59.999 argentina", () => {
    const r = parseTermDates(fd({ endsAt: "2026-12-31" }));
    expect(r.ok && r.endsAt?.toISOString()).toBe("2027-01-01T02:59:59.999Z");
  });
  it("error si el fin es anterior al inicio", () => {
    expect(parseTermDates(fd({ startsAt: "2026-05-02", endsAt: "2026-05-01" })).ok).toBe(false);
  });
  it("mismo día es válido", () => {
    expect(parseTermDates(fd({ startsAt: "2026-05-01", endsAt: "2026-05-01" })).ok).toBe(true);
  });
  it("error con formato inválido o fecha inexistente", () => {
    expect(parseTermDates(fd({ startsAt: "01/05/2026" })).ok).toBe(false);
    expect(parseTermDates(fd({ endsAt: "2026-02-31" })).ok).toBe(false);
  });
});
