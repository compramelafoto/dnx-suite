import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ role: vi.fn() }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));

const { canEditWebsiteIdentity } = await import("./identity-access");

beforeEach(() => H.role.mockReset());

describe("canEditWebsiteIdentity: logo y favicon son de dueño/admin", () => {
  it.each([
    ["WORKSPACE_OWNER", true],
    ["WORKSPACE_ADMIN", true],
    ["STAFF", false],
    [null, false],
  ])("%s → %s", async (role, esperado) => {
    H.role.mockResolvedValue(role);
    expect(await canEditWebsiteIdentity(7, "ws-1")).toBe(esperado);
    expect(H.role).toHaveBeenCalledWith(7, "ws-1");
  });
});
