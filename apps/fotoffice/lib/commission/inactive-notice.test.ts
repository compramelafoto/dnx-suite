import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  db: {
    member: { findFirst: vi.fn() },
    workspaceOfficeTerm: { findMany: vi.fn() },
    workspaceRoleAssignment: { findMany: vi.fn() },
    workspaceMembership: { findMany: vi.fn() },
  },
  sendAndLogEmail: vi.fn(),
  loadWorkspaceEmailContext: vi.fn(),
}));

vi.mock("@repo/db", () => ({ prisma: H.db }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: H.sendAndLogEmail }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: H.loadWorkspaceEmailContext,
}));

const { notifyAdminsIfCommissionMemberInactive } = await import("./inactive-notice");

const NOW = new Date("2026-10-03T15:00:00.000Z");
const PAST = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = new Date("2027-01-01T00:00:00.000Z");

function term(over: Partial<{ startsAt: Date | null; endsAt: Date | null; revokedAt: Date | null }> = {}) {
  return { startsAt: PAST, endsAt: null, revokedAt: null, office: { name: "Tesorera" }, ...over };
}
function assignment(over: Partial<{ startsAt: Date | null; endsAt: Date | null; revokedAt: Date | null }> = {}) {
  return { startsAt: PAST, endsAt: null, revokedAt: null, role: { name: "Tesorería" }, ...over };
}

function setup(opts: { terms?: ReturnType<typeof term>[]; assignments?: ReturnType<typeof assignment>[] } = {}) {
  H.db.member.findFirst.mockResolvedValue({ firstName: "Ana", lastName: "Pérez", userId: 7 });
  H.db.workspaceOfficeTerm.findMany.mockResolvedValue(opts.terms ?? []);
  H.db.workspaceRoleAssignment.findMany.mockResolvedValue(opts.assignments ?? []);
  H.db.workspaceMembership.findMany.mockResolvedValue([
    { user: { id: 1, email: "duena@x.test" } },
    { user: { id: 2, email: "admin@x.test" } },
    { user: { id: 3, email: null } },
  ]);
}

const input = { workspaceId: "w1", memberId: "m1", newStatus: "SUSPENDED" as const, now: NOW };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
  H.loadWorkspaceEmailContext.mockResolvedValue({ organizationName: "Sociedad Fotográfica", signature: null });
  H.sendAndLogEmail.mockResolvedValue({ status: "SENT", providerId: "r1" });
});

describe("notifyAdminsIfCommissionMemberInactive", () => {
  it("ACTIVE no manda nada", async () => {
    setup({ terms: [term()] });
    expect(await notifyAdminsIfCommissionMemberInactive({ ...input, newStatus: "ACTIVE" })).toEqual({ sent: 0 });
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
  });

  it("sin cargo ni rol vigente no manda", async () => {
    setup();
    expect(await notifyAdminsIfCommissionMemberInactive(input)).toEqual({ sent: 0 });
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
  });

  it("con mandato vigente manda a dueño y admins con correo, y el correo nombra cargo y roles", async () => {
    setup({ terms: [term()], assignments: [assignment()] });
    expect(await notifyAdminsIfCommissionMemberInactive(input)).toEqual({ sent: 2 });
    expect(H.db.workspaceMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: "w1", role: { in: ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"] } },
      }),
    );
    const calls = H.sendAndLogEmail.mock.calls.map((c) => c[0] as { to: string; templateKey: string; userId: number; body: { text: string } });
    expect(calls.map((c) => c.to)).toEqual(["duena@x.test", "admin@x.test"]);
    expect(calls[0].userId).toBe(1);
    expect(calls[0].body.text).toContain("Tesorera");
    expect(calls[0].body.text).toContain("Tesorería");
    expect(calls[0].body.text).toContain("Ana Pérez");
    expect(calls[0].body.text).toContain("https://app.test/workspace/configuracion/comision");
  });

  it("busca por ficha o por la cuenta vinculada", async () => {
    setup({ terms: [term()] });
    await notifyAdminsIfCommissionMemberInactive(input);
    const where = H.db.workspaceOfficeTerm.findMany.mock.calls[0][0].where as { OR: unknown[] };
    expect(where.OR).toEqual([{ memberId: "m1" }, { userId: 7 }]);
  });

  it("mandato vencido, futuro o revocado no cuenta; asignación vencida tampoco", async () => {
    setup({
      terms: [term({ endsAt: PAST }), term({ startsAt: FUTURE }), term({ revokedAt: PAST })],
      assignments: [assignment({ endsAt: NOW })],
    });
    expect(await notifyAdminsIfCommissionMemberInactive(input)).toEqual({ sent: 0 });
  });

  it("sólo con asignación vigente también avisa", async () => {
    setup({ assignments: [assignment()] });
    expect(await notifyAdminsIfCommissionMemberInactive(input)).toEqual({ sent: 2 });
  });

  it("sin URL pública no manda y lo deja en el registro de errores", async () => {
    setup({ terms: [term()] });
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    expect(await notifyAdminsIfCommissionMemberInactive(input)).toEqual({ sent: 0 });
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("si un envío no sale, no cuenta", async () => {
    setup({ terms: [term()] });
    H.sendAndLogEmail.mockResolvedValueOnce({ status: "INTERNAL_ERROR", detail: "x" });
    expect(await notifyAdminsIfCommissionMemberInactive(input)).toEqual({ sent: 1 });
  });
});
