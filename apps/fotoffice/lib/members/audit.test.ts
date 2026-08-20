import { describe, expect, it } from "vitest";
import { auditActorFrom, normalizeReason, statusRequiresReason } from "./audit";
import type { AuthUser } from "@/lib/auth";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 7,
    name: "Ana Gómez",
    email: "ana@sfpr.test",
    role: "USER",
    globalRole: "USER",
    currentWorkspaceId: "ws-1",
    workspaceRole: "WORKSPACE_ADMIN",
    appAccess: [],
    ...overrides,
  };
}

describe("snapshot del actor", () => {
  it("prefiere el nombre visible", () => {
    expect(auditActorFrom(user())).toEqual({ userId: 7, label: "Ana Gómez" });
  });

  it("cae al email solo si no hay nombre", () => {
    expect(auditActorFrom(user({ name: null })).label).toBe("ana@sfpr.test");
  });

  it("un nombre de solo espacios no se guarda como label", () => {
    expect(auditActorFrom(user({ name: "   " })).label).toBe("ana@sfpr.test");
  });

  it("siempre conserva el userId real para la FK", () => {
    expect(auditActorFrom(user({ name: null })).userId).toBe(7);
  });
});

describe("motivo obligatorio por estado", () => {
  it("suspensión exige motivo", () => {
    expect(statusRequiresReason("SUSPENDED")).toBe(true);
  });

  it("baja exige motivo", () => {
    expect(statusRequiresReason("INACTIVE")).toBe(true);
  });

  it("reactivación NO exige motivo", () => {
    expect(statusRequiresReason("ACTIVE")).toBe(false);
  });

  it("un motivo de solo espacios equivale a no haber puesto motivo", () => {
    expect(normalizeReason("   ")).toBeNull();
    expect(normalizeReason("\t\n ")).toBeNull();
  });

  it("un motivo real se conserva recortado", () => {
    expect(normalizeReason("  Cuota impaga  ")).toBe("Cuota impaga");
  });

  it("null y undefined son ausencia de motivo", () => {
    expect(normalizeReason(null)).toBeNull();
    expect(normalizeReason(undefined)).toBeNull();
  });
});
