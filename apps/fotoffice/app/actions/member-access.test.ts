import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  sync: vi.fn(),
  getMember: vi.fn(),
  link: vi.fn(),
  findUser: vi.fn(),
  unlink: vi.fn(),
  release: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db/fotoffice-members", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db/fotoffice-members")>();
  return { ...real, getMember: H.getMember, linkMemberToUser: H.link, unlinkMemberFromUser: H.unlink };
});
vi.mock("@repo/db/fotoffice-user-lookup", () => ({ findLinkableUserByEmail: H.findUser }));
vi.mock("@/lib/commission/team-membership", () => ({
  syncPendingTeamMemberships: H.sync,
  releaseAfterMemberUnlink: H.release,
}));
vi.mock("@/lib/members/access", () => ({
  requireMembersManageContext: async () => ({ workspace: { id: "ws-1" }, user: { id: 1 } }),
}));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: vi.fn() }));
vi.mock("@/lib/members/audit", () => ({ auditActorFrom: () => ({}), normalizeReason: (r: string) => r }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: vi.fn() }));

const { linkMemberUserAction, unlinkMemberUserAction } = await import("./member-access");

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
  H.unlink.mockReset().mockResolvedValue(undefined);
  H.release.mockReset().mockResolvedValue("removed");
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

describe("unlinkMemberUserAction", () => {
  const unlinkForm = () => {
    const f = new FormData();
    f.set("memberId", "m-1");
    f.set("reason", "Pidió la baja de la cuenta");
    return f;
  };

  beforeEach(() => {
    H.getMember.mockResolvedValue({ id: "m-1", email: "a@b.com", userId: 42, updatedAt: new Date() });
  });

  it("desvinculado no vuelve a la compatibilidad: libera con la cuenta que tenía", async () => {
    const r = await unlinkMemberUserAction(undefined, unlinkForm());
    expect(r).toEqual({ error: null, ok: true });
    expect(H.release).toHaveBeenCalledWith("ws-1", "m-1", 42);
  });

  it("si la desvinculación falla, no libera nada", async () => {
    H.unlink.mockRejectedValue(new Error("x"));
    const r = await unlinkMemberUserAction(undefined, unlinkForm());
    expect(r.error).toBeTruthy();
    expect(H.release).not.toHaveBeenCalled();
  });

  it("si liberar falla, la desvinculación igual sale bien", async () => {
    H.release.mockRejectedValue(new Error("base caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await unlinkMemberUserAction(undefined, unlinkForm());
    expect(r).toEqual({ error: null, ok: true });
  });
});
