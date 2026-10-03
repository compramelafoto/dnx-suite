import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  sync: vi.fn(),
  getMember: vi.fn(),
  link: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db/fotoffice-members", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db/fotoffice-members")>();
  return { ...real, getMember: H.getMember, linkMemberToUser: H.link };
});
vi.mock("@repo/db/fotoffice-user-lookup", () => ({ findLinkableUserByEmail: H.findUser }));
vi.mock("@/lib/commission/team-membership", () => ({ syncPendingTeamMemberships: H.sync }));
vi.mock("@/lib/members/access", () => ({
  requireMembersManageContext: async () => ({ workspace: { id: "ws-1" }, user: { id: 1 } }),
}));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: vi.fn() }));
vi.mock("@/lib/members/audit", () => ({ auditActorFrom: () => ({}), normalizeReason: (r: string) => r }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: vi.fn() }));

const { linkMemberUserAction } = await import("./member-access");

const form = () => {
  const f = new FormData();
  f.set("memberId", "m-1");
  f.set("userId", "42");
  f.set("email", "a@b.com");
  return f;
};

beforeEach(() => {
  H.sync.mockReset().mockResolvedValue(1);
  H.getMember.mockReset().mockResolvedValue({ id: "m-1", email: "a@b.com", userId: null, updatedAt: new Date() });
  H.link.mockReset().mockResolvedValue(undefined);
  H.findUser.mockReset().mockResolvedValue({ id: 42, email: "a@b.com", name: "A" });
});

describe("linkMemberUserAction", () => {
  it("tras vincular sincroniza la membresía del usuario vinculado, no la del administrador", async () => {
    const r = await linkMemberUserAction(undefined, form());
    expect(r).toEqual({ error: null, ok: true });
    expect(H.sync).toHaveBeenCalledWith(42);
  });

  it("si la vinculación falla, no sincroniza", async () => {
    H.link.mockRejectedValue(new Error("x"));
    const r = await linkMemberUserAction(undefined, form());
    expect(r.error).toBeTruthy();
    expect(H.sync).not.toHaveBeenCalled();
  });
});
