import { describe, expect, it } from "vitest";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { canConfigureMembers, canManageMembers } from "@/lib/members/role-policy";
import { canConfigureCoverages, canCoordinateCoverages, canReviewCoverages } from "@/lib/coverages/access-policy";

describe("auditoría 0.1 — Equipo opera, sólo configura Dueño/Admin", () => {
  it("Equipo opera socios pero no configura", () => {
    expect(canManageMembers("STAFF")).toBe(true);
    expect(canConfigureMembers("STAFF")).toBe(false);
  });
  it("Equipo coordina coberturas pero no las configura", () => {
    expect(canCoordinateCoverages("STAFF")).toBe(true);
    expect(canReviewCoverages("STAFF")).toBe(true);
    expect(canConfigureCoverages("STAFF")).toBe(false);
  });
  it("Equipo no toca configuración del workspace", () => {
    expect(canManageWorkspaceSettings("STAFF")).toBe(false);
  });
  it("Colaborador no opera ni configura nada existente", () => {
    for (const f of [canManageMembers, canConfigureMembers, canCoordinateCoverages, canReviewCoverages, canConfigureCoverages, canManageWorkspaceSettings]) {
      expect(f("COLLABORATOR")).toBe(false);
    }
  });
  it("Dueño y Admin pueden todo lo anterior", () => {
    for (const r of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"]) {
      for (const f of [canManageMembers, canConfigureMembers, canCoordinateCoverages, canReviewCoverages, canConfigureCoverages, canManageWorkspaceSettings]) {
        expect(f(r)).toBe(true);
      }
    }
  });
});
