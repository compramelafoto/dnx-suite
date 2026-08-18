import { describe, expect, it } from "vitest";
import { canManageWorkspaceSettings } from "./workspace-settings-access";

describe("canManageWorkspaceSettings", () => {
  it("WORKSPACE_OWNER puede administrar la configuración general", () => {
    expect(canManageWorkspaceSettings("WORKSPACE_OWNER")).toBe(true);
  });

  it("WORKSPACE_ADMIN (unificado) puede administrar la configuración general", () => {
    expect(canManageWorkspaceSettings("WORKSPACE_ADMIN")).toBe(true);
  });

  it("ADMIN (legacy Membership) puede administrar la configuración general", () => {
    expect(canManageWorkspaceSettings("ADMIN")).toBe(true);
  });

  it("STAFF NO puede administrar la configuración general (solo lectura)", () => {
    expect(canManageWorkspaceSettings("STAFF")).toBe(false);
  });

  it("MEMBER (legacy) NO puede administrar la configuración general", () => {
    expect(canManageWorkspaceSettings("MEMBER")).toBe(false);
  });

  it("sin rol (null/undefined) NO puede administrar la configuración general", () => {
    expect(canManageWorkspaceSettings(null)).toBe(false);
    expect(canManageWorkspaceSettings(undefined)).toBe(false);
  });
});
