import { describe, expect, it } from "vitest";
import { canManageMembers } from "./role-policy";

describe("canManageMembers — N: política OWNER/ADMIN/STAFF", () => {
  it("WORKSPACE_OWNER puede administrar", () => {
    expect(canManageMembers("WORKSPACE_OWNER")).toBe(true);
  });

  it("WORKSPACE_ADMIN puede administrar", () => {
    expect(canManageMembers("WORKSPACE_ADMIN")).toBe(true);
  });

  it("ADMIN (rol legacy Membership) puede administrar", () => {
    expect(canManageMembers("ADMIN")).toBe(true);
  });

  it("STAFF NO puede administrar (solo consulta)", () => {
    expect(canManageMembers("STAFF")).toBe(false);
  });

  it("sin membership (null/undefined) NO puede administrar", () => {
    expect(canManageMembers(null)).toBe(false);
    expect(canManageMembers(undefined)).toBe(false);
  });

  it("un rol desconocido no otorga permisos por accidente", () => {
    expect(canManageMembers("ALGO_INVENTADO")).toBe(false);
  });
});
