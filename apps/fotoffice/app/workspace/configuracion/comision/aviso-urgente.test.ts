import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingIntegrant } from "@/lib/commission/urgent-notice";

const H = vi.hoisted(() => ({
  requireCommissionAdmin: vi.fn(),
  listPendingIntegrants: vi.fn(),
  inviteOneMember: vi.fn(),
  sendAndLogEmail: vi.fn(),
  loadWorkspaceEmailContext: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidatePath }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@repo/db/fotoffice-user-lookup", () => ({ findLinkableUserByEmail: vi.fn() }));
vi.mock("@/lib/commission/access", () => ({ requireCommissionAdmin: H.requireCommissionAdmin }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: H.sendAndLogEmail }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: H.loadWorkspaceEmailContext,
}));
vi.mock("@/lib/commission/team-membership", () => ({
  syncStaffMembershipWithRoles: vi.fn(),
  releaseStaffMembershipIfNoRoles: vi.fn(),
}));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: vi.fn() }));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: H.inviteOneMember }));
vi.mock("@/lib/commission/urgent-notice", async (orig) => ({
  ...(await orig<typeof import("@/lib/commission/urgent-notice")>()),
  listPendingIntegrants: H.listPendingIntegrants,
}));

const { sendUrgentCommissionNoticeAction } = await import("./actions");

const ADMIN = { user: { id: 1, email: "owner@sfpr.test", name: "Owner" }, workspaceId: "ws-1" };

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
}

function pending(over: Partial<PendingIntegrant>): PendingIntegrant {
  return {
    memberId: "m1",
    name: "Ana Pérez",
    firstName: "Ana",
    email: "ana@test.com",
    hasEmail: true,
    officeName: "Tesorería",
    roleNames: ["Tesorería"],
    reason: "SIN_CUENTA",
    pendingCount: 0,
    pendingTotalMinor: 0,
    pendingTotalArs: 0,
    status: "ACTIVE",
    userId: null,
    blocker: null,
    lastNoticeAt: null,
    ...over,
  };
}

const CTX = { memberFirstName: "Ana", institution: "SFPR", invitationUrl: "https://app.test/i/x", signature: null };

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.requireCommissionAdmin.mockResolvedValue(ADMIN);
  H.listPendingIntegrants.mockResolvedValue([]);
  H.inviteOneMember.mockResolvedValue({ error: null, ok: true, sentTo: "x" });
  H.sendAndLogEmail.mockResolvedValue({ status: "SENT", providerId: "p" });
  H.loadWorkspaceEmailContext.mockResolvedValue({ organizationName: "SFPR", signature: null });
  process.env.NEXT_PUBLIC_APP_URL = "https://app.fotoffice.test";
});

describe("sendUrgentCommissionNoticeAction", () => {
  it("sin permiso de admin termina en el redirect y no manda nada", async () => {
    H.requireCommissionAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/workspace/configuracion"));
    await expect(sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(H.listPendingIntegrants).not.toHaveBeenCalled();
    expect(H.inviteOneMember).not.toHaveBeenCalled();
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
  });

  it("sin confirm=yes no manda nada", async () => {
    H.listPendingIntegrants.mockResolvedValue([pending({})]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({}));
    expect(res.error).toMatch(/Confirmá/);
    expect(H.listPendingIntegrants).not.toHaveBeenCalled();
    expect(H.inviteOneMember).not.toHaveBeenCalled();
  });

  it("lee sólo los integrantes del propio workspace e invita en ese workspace", async () => {
    H.listPendingIntegrants.mockResolvedValue([pending({})]);
    await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(H.listPendingIntegrants).toHaveBeenCalledWith("ws-1", expect.any(Date));
    expect(H.inviteOneMember).toHaveBeenCalledWith({ id: "ws-1" }, ADMIN.user, "m1", expect.any(Object));
  });

  it("A) sin cuenta → invitación con el texto urgente", async () => {
    H.listPendingIntegrants.mockResolvedValue([pending({})]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.sent).toEqual([{ name: "Ana Pérez", kind: "INVITACION" }]);
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
    const body = H.inviteOneMember.mock.calls[0][3].buildBody(CTX);
    expect(body.subject).toBe("URGENTE: activá tu cuenta para gestionar la Comisión Directiva de SFPR");
    expect(body.text).toContain("https://app.test/i/x");
    expect(body.text).not.toContain("cuota");
    expect(H.revalidatePath).toHaveBeenCalledWith("/workspace/configuracion/comision", "layout");
  });

  it("B) con cuenta y deuda → aviso de cuotas con el enlace al portal", async () => {
    H.listPendingIntegrants.mockResolvedValue([
      pending({ reason: "DEUDA", userId: 9, pendingCount: 2, pendingTotalMinor: 2_400_000 }),
    ]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.sent).toEqual([{ name: "Ana Pérez", kind: "DEUDA" }]);
    expect(H.inviteOneMember).not.toHaveBeenCalled();
    const call = H.sendAndLogEmail.mock.calls[0][0];
    expect(call).toMatchObject({ workspaceId: "ws-1", to: "ana@test.com", templateKey: "commission-urgent-debt", userId: 9 });
    expect(call.body.subject).toBe("URGENTE: regularizá tu situación para gestionar la Comisión Directiva de SFPR");
    expect(call.body.text).toContain("https://app.fotoffice.test/portal/cuotas");
    expect(call.body.text).toContain("Tenés 2 cuotas pendientes por $ 24.000.");
  });

  it("A+B) sin cuenta y con deuda → una sola invitación que menciona la deuda", async () => {
    H.listPendingIntegrants.mockResolvedValue([
      pending({ reason: "SIN_CUENTA_Y_DEUDA", pendingCount: 1, pendingTotalMinor: 1_200_000 }),
    ]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.sent).toEqual([{ name: "Ana Pérez", kind: "INVITACION" }]);
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
    const body = H.inviteOneMember.mock.calls[0][3].buildBody(CTX);
    expect(body.text).toContain("Tenés 1 cuota pendiente por $ 12.000.");
  });

  it("saltea a quien no tiene correo o no puede recibir invitación, y lo informa", async () => {
    H.listPendingIntegrants.mockResolvedValue([
      pending({ memberId: "a", name: "Sin Correo", email: null, hasEmail: false, blocker: "No tiene correo cargado." }),
      pending({ memberId: "b", name: "Suspendida", status: "SUSPENDED", blocker: "La ficha no está activa: no se le puede mandar la invitación." }),
    ]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.skipped).toEqual([
      { name: "Sin Correo", reason: "No tiene correo cargado." },
      { name: "Suspendida", reason: "La ficha no está activa: no se le puede mandar la invitación." },
    ]);
    expect(H.inviteOneMember).not.toHaveBeenCalled();
  });

  it("un fallo no frena a los demás", async () => {
    H.listPendingIntegrants.mockResolvedValue([
      pending({ memberId: "a", name: "Uno" }),
      pending({ memberId: "b", name: "Dos" }),
      pending({ memberId: "c", name: "Tres", reason: "DEUDA", userId: 4, pendingCount: 1, pendingTotalMinor: 100 }),
      pending({ memberId: "d", name: "Cuatro", reason: "DEUDA", userId: 5, pendingCount: 1, pendingTotalMinor: 100 }),
      pending({ memberId: "e", name: "Cinco" }),
    ]);
    H.inviteOneMember
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ error: "La invitación quedó creada pero el email no salió." })
      .mockResolvedValueOnce({ error: null, ok: true, sentTo: "x" });
    H.sendAndLogEmail
      .mockResolvedValueOnce({ status: "PROVIDER_ERROR", detail: "x" })
      .mockResolvedValueOnce({ status: "SENT", providerId: "p" });

    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.ok).toBe(true);
    expect(res.failed.map((f) => f.name)).toEqual(["Uno", "Dos", "Tres"]);
    expect(res.failed[1].reason).toContain("no salió");
    expect(res.sent).toEqual([
      { name: "Cuatro", kind: "DEUDA" },
      { name: "Cinco", kind: "INVITACION" },
    ]);
  });

  it("si ya se le avisó hace menos de 24 h, un segundo envío saltea a todos y no manda nada", async () => {
    const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
    H.listPendingIntegrants.mockResolvedValue([
      pending({ memberId: "a", name: "Uno", lastNoticeAt: haceUnaHora }),
      pending({ memberId: "b", name: "Dos", reason: "DEUDA", userId: 4, pendingCount: 1, pendingTotalMinor: 100, lastNoticeAt: haceUnaHora }),
    ]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.sent).toEqual([]);
    expect(res.skipped.map((s) => s.name)).toEqual(["Uno", "Dos"]);
    expect(res.skipped[0].reason).toMatch(/^Ya se le avisó el \d{2}\/\d{2} a las \d{2}:\d{2}$/);
    expect(H.inviteOneMember).not.toHaveBeenCalled();
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
  });

  it("pasadas las 24 h, vuelve a mandar", async () => {
    const ayer = new Date(Date.now() - 25 * 60 * 60 * 1000);
    H.listPendingIntegrants.mockResolvedValue([
      pending({ memberId: "a", name: "Uno", lastNoticeAt: ayer }),
      pending({ memberId: "b", name: "Dos", reason: "DEUDA", userId: 4, pendingCount: 1, pendingTotalMinor: 100, lastNoticeAt: ayer }),
    ]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.sent).toEqual([
      { name: "Uno", kind: "INVITACION" },
      { name: "Dos", kind: "DEUDA" },
    ]);
    expect(res.skipped).toEqual([]);
  });

  it("sin dirección pública, el aviso de deuda falla sin mandar nada roto", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    H.listPendingIntegrants.mockResolvedValue([pending({ reason: "DEUDA", userId: 2, pendingCount: 1, pendingTotalMinor: 100 })]);
    const res = await sendUrgentCommissionNoticeAction(undefined, form({ confirm: "yes" }));
    expect(res.failed).toHaveLength(1);
    expect(H.sendAndLogEmail).not.toHaveBeenCalled();
  });
});
