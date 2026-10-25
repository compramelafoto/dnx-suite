import { describe, expect, it } from "vitest";
import { parseOpenGroups, serializeOpenGroupsCookie, toggleGroup, visibleOpenGroups } from "./nav-groups";

describe("parseOpenGroups", () => {
  it("lee lo que escribió el menú", () => {
    const cookie = serializeOpenGroupsCookie(["Socios", "Presencia pública"]);
    const valor = cookie.split(";")[0]!.split("=")[1];
    expect(parseOpenGroups(valor)).toEqual(["Socios", "Presencia pública"]);
  });
  it("una cookie ausente o rota no abre nada", () => {
    expect(parseOpenGroups(undefined)).toEqual([]);
    expect(parseOpenGroups("%%%")).toEqual([]);
    expect(parseOpenGroups(encodeURIComponent('{"a":1}'))).toEqual([]);
  });
  it("descarta lo que no es un título", () => {
    expect(parseOpenGroups(encodeURIComponent(JSON.stringify(["Socios", 3, "<script>", "x".repeat(80), "Socios"])))).toEqual(["Socios"]);
  });
});

describe("toggleGroup", () => {
  it("abre y cierra", () => {
    expect(toggleGroup(["Socios"], "Sorteos")).toEqual(["Socios", "Sorteos"]);
    expect(toggleGroup(["Socios", "Sorteos"], "Socios")).toEqual(["Sorteos"]);
  });
});

describe("visibleOpenGroups", () => {
  it("el grupo de la pantalla actual se ve abierto aunque estuviera cerrado", () => {
    expect([...visibleOpenGroups(["Socios"], "Comisión")]).toEqual(["Socios", "Comisión"]);
    expect([...visibleOpenGroups([], null)]).toEqual([]);
  });
});
