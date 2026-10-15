import { describe, expect, it } from "vitest";
import { canManageWorkspaceImages, canUploadWorkspaceImages } from "./access";

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

describe("canUploadWorkspaceImages — dueño/admin o rol con Sitio web en MANAGE", () => {
  it("dueño y administrador suben aunque no tengan nivel de sitio web (logo de la institución)", () => {
    expect(canUploadWorkspaceImages("WORKSPACE_OWNER", "NONE")).toBe(true);
    expect(canUploadWorkspaceImages("WORKSPACE_ADMIN", "VIEW")).toBe(true);
  });

  it("STAFF sin roles (sitio web en VIEW por compatibilidad) sigue sin subir", () => {
    expect(canUploadWorkspaceImages("STAFF", "VIEW")).toBe(false);
  });

  it("un rol con Sitio web en MANAGE sube aunque sea STAFF", () => {
    expect(canUploadWorkspaceImages("STAFF", "MANAGE")).toBe(true);
  });

  it("sin membership y sin nivel no sube", () => {
    expect(canUploadWorkspaceImages(null, "NONE")).toBe(false);
  });
});
