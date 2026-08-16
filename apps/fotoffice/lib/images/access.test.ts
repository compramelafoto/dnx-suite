import { describe, expect, it } from "vitest";
import { canManageWorkspaceImages } from "./access";

describe("canManageWorkspaceImages — subir/reemplazar imágenes institucionales es acción de administración", () => {
  it("WORKSPACE_OWNER puede subir", () => {
    expect(canManageWorkspaceImages("WORKSPACE_OWNER")).toBe(true);
  });

  it("WORKSPACE_ADMIN puede subir", () => {
    expect(canManageWorkspaceImages("WORKSPACE_ADMIN")).toBe(true);
  });

  it("ADMIN (rol legacy Membership) puede subir", () => {
    expect(canManageWorkspaceImages("ADMIN")).toBe(true);
  });

  it("STAFF NO puede subir imágenes institucionales", () => {
    expect(canManageWorkspaceImages("STAFF")).toBe(false);
  });

  it("sin membership (null/undefined) NO puede subir", () => {
    expect(canManageWorkspaceImages(null)).toBe(false);
    expect(canManageWorkspaceImages(undefined)).toBe(false);
  });
});
