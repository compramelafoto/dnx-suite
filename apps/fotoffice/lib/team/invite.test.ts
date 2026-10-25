import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const mark = vi.fn();
const { FakeTeamError } = vi.hoisted(() => ({
  FakeTeamError: class extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
}));
vi.mock("@repo/db/fotoffice-team", () => ({
  createTeamInvitation: (...a: unknown[]) => create(...a),
  markTeamInvitationDelivery: (...a: unknown[]) => mark(...a),
  TeamError: FakeTeamError,
}));
const send = vi.fn();
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: (...a: unknown[]) => send(...a) }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({ organizationName: "Club", signature: null }),
}));

import { inviteTeamMember } from "./invite";

const P = { workspaceId: "w1", actor: { id: 1, name: "Ana" }, email: " Juan@Test.com ", role: "STAFF" };

beforeEach(() => {
  vi.resetAllMocks();
  process.env.APP_URL = "https://app.test";
  create.mockResolvedValue({ id: "inv1", resend: false });
});

describe("inviteTeamMember", () => {
  it("email inválido", async () => {
    expect(await inviteTeamMember({ ...P, email: "nope" })).toEqual({ ok: false, error: "Revisá el correo." });
    expect(create).not.toHaveBeenCalled();
  });

  it("sin APP_URL", async () => {
    delete process.env.APP_URL;
    expect(await inviteTeamMember(P)).toEqual({ ok: false, error: "Falta configurar la dirección de la app." });
    expect(create).not.toHaveBeenCalled();
  });

  it("ya es parte del equipo", async () => {
    create.mockRejectedValue(new FakeTeamError("ALREADY_MEMBER"));
    expect(await inviteTeamMember(P)).toEqual({ ok: false, error: "Esa persona ya es parte del equipo." });
    expect(send).not.toHaveBeenCalled();
  });

  it("envío ok", async () => {
    send.mockResolvedValue({ status: "SENT" });
    const r = await inviteTeamMember(P);
    expect(r).toEqual({ ok: true, sentTo: "juan@test.com", url: expect.stringMatching(/^https:\/\/app\.test\/invitacion\/equipo\/.+/) });
    expect(mark).toHaveBeenCalledWith("inv1", true);
    // El enlace lleva el token en claro; a la base va sólo su hash.
    const token = (r as { url: string }).url.split("/").pop()!;
    expect(create.mock.calls[0][0].tokenHash).not.toBe(token);
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(token);
  });

  it("envío fallido", async () => {
    send.mockResolvedValue({ status: "FAILED" });
    expect(await inviteTeamMember(P)).toEqual({
      ok: true,
      sentTo: "juan@test.com",
      url: expect.stringContaining("/invitacion/equipo/"),
      warn: "La invitación quedó creada pero el correo no salió. Podés reenviarla o mandarle el enlace.",
    });
    expect(mark).toHaveBeenCalledWith("inv1", false);
  });
});
