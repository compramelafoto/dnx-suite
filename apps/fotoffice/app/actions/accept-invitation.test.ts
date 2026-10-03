import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  sync: vi.fn(),
  accept: vi.fn(),
  getAuthUser: vi.fn(),
  findUnique: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("@repo/db/fotoffice-members", () => ({ MemberLinkError: class extends Error {} }));
vi.mock("@repo/db/fotoffice-member-invitations", () => ({ acceptMemberInvitation: H.accept }));
vi.mock("@repo/db", () => ({ prisma: { memberInvitation: { findUnique: H.findUnique } } }));
vi.mock("@/lib/commission/team-membership", () => ({ syncPendingTeamMemberships: H.sync }));
vi.mock("@/lib/auth", () => ({ getAuthUser: H.getAuthUser }));
vi.mock("@/lib/members/audit", () => ({ auditActorFrom: () => ({}) }));
vi.mock("@/lib/members/invitations", () => ({
  canMemberUseInvitations: () => true,
  emailsMatch: () => true,
  invitationState: () => "PENDING",
}));
vi.mock("@/lib/members/invitation-continuity", () => ({ clearInvitationContinuity: vi.fn() }));
vi.mock("@/lib/portal/destination", () => ({ resolvePortalDestination: () => "/portal" }));
vi.mock("@/lib/members/mensajes", () => ({ mensajeDePadron: () => "x" }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: vi.fn() }));

const { acceptInvitationAction } = await import("./accept-invitation");

const form = () => {
  const f = new FormData();
  f.set("invitationId", "inv-1");
  return f;
};

beforeEach(() => {
  H.sync.mockReset().mockResolvedValue(1);
  H.accept.mockReset().mockResolvedValue(undefined);
  H.getAuthUser.mockReset().mockResolvedValue({ id: 12, email: "a@b.com" });
  H.findUnique.mockReset().mockResolvedValue({
    id: "inv-1",
    email: "a@b.com",
    expiresAt: null,
    acceptedAt: null,
    revokedAt: null,
    member: { status: "ACTIVE", workspaceId: "ws-1" },
  });
  H.redirect.mockReset();
});

describe("acceptInvitationAction", () => {
  it("tras aceptar con éxito sincroniza la membresía de equipo del usuario vinculado", async () => {
    await acceptInvitationAction(undefined, form());
    expect(H.sync).toHaveBeenCalledWith(12);
    expect(H.redirect).toHaveBeenCalledWith("/portal");
  });

  it("si la vinculación falla, no sincroniza", async () => {
    H.accept.mockRejectedValue(new Error("x"));
    const r = await acceptInvitationAction(undefined, form());
    expect(r.error).toBeTruthy();
    expect(H.sync).not.toHaveBeenCalled();
  });
});
