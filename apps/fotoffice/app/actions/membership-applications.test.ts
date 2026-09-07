import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La costura de la resolución: aprobar y rechazar, con sus avisos.
 *
 * Lo que se prueba acá no es la lógica del alta —eso vive en `approve.ts` y ya está probado—
 * sino que **nadie se quede sin enterarse**: que el aprobado reciba su acceso, que el
 * rechazado reciba el motivo, y que cuando el correo no sale la Secretaría se entere de que
 * quedó algo por hacer en vez de ver un cartel verde.
 */

const H = vi.hoisted(() => ({
  requireWorkspace: vi.fn(),
  canManage: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  inviteOne: vi.fn(),
  sendAndLog: vi.fn(),
  emailContext: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, prisma: { fotofficeWorkspaceBranding: { findUnique: vi.fn() } } };
});
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: H.requireWorkspace }));
vi.mock("@/lib/payments/connect/authz", () => ({ canManageWorkspaceCollection: H.canManage }));
vi.mock("@/lib/payments/connect/status", () => ({ getWorkspaceCollectionStatus: vi.fn() }));
vi.mock("@/lib/membership/repository", () => ({
  approveApplication: H.approve,
  rejectApplication: H.reject,
}));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: H.inviteOne }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: H.sendAndLog }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: H.emailContext,
}));

const { approveApplicationAction, rejectApplicationAction } = await import(
  "./membership-applications"
);

const USUARIO = { id: 7, email: "secretaria@sfpr.test", name: "Secretaría" };

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  H.requireWorkspace.mockReset().mockResolvedValue({
    user: USUARIO,
    workspace: { id: "ws-sfpr", name: "Club SFPR" },
  });
  H.canManage.mockReset().mockResolvedValue(true);
  H.approve.mockReset().mockResolvedValue({
    memberId: "m-1",
    memberNumber: "735",
    totalArs: "24000.00",
    chargeCount: 3,
    expiresAt: new Date("2026-10-06T12:00:00.000Z"),
    includesPrintedCard: false,
    applicant: { firstName: "Ana", email: "ana@test.com" },
  });
  H.reject.mockReset().mockResolvedValue({ applicant: { firstName: "Ana", email: "ana@test.com" } });
  H.inviteOne.mockReset().mockResolvedValue({ error: null, ok: true, sentTo: "ana@test.com" });
  H.sendAndLog.mockReset().mockResolvedValue({ status: "SENT", providerId: "re_1" });
  H.emailContext.mockReset().mockResolvedValue({ organizationName: "Club SFPR", signature: null });
});

describe("aprobar", () => {
  /**
   * Es la razón por la que la invitación se emite en la aprobación: las cuotas de ingreso se
   * pagan desde el portal, y sin cuenta no hay portal. Un aprobado sin acceso vería vencer su
   * solicitud por una puerta que nunca se le abrió.
   */
  it("le da el acceso al socio nuevo, no solo lo crea", async () => {
    const r = await approveApplicationAction(undefined, form({ applicationId: "app-1" }));

    expect(H.inviteOne).toHaveBeenCalledWith(
      { id: "ws-sfpr" },
      USUARIO,
      "m-1",
      expect.objectContaining({ buildBody: expect.any(Function) }),
    );
    expect(r.error).toBeNull();
    expect(r.ok).toContain("735");
    expect(r.ok).toContain("ana@test.com");
  });

  it("el email que sale es el de aprobación, con el importe y el plazo, no la invitación genérica", async () => {
    await approveApplicationAction(undefined, form({ applicationId: "app-1" }));

    const [, , , opciones] = H.inviteOne.mock.calls[0] as [
      unknown,
      unknown,
      unknown,
      { buildBody: (c: unknown) => { subject: string; text: string } },
    ];
    const body = opciones.buildBody({
      memberFirstName: "Ana",
      institution: "Club SFPR",
      invitationUrl: "https://fotoffice.test/invitacion/abc",
      signature: null,
    });

    expect(body.subject).toContain("aprobada");
    expect(body.text).toContain("735");
    expect(body.text).toContain("24.000,00");
    expect(body.text).toContain("6 de octubre");
    expect(body.text).toContain("https://fotoffice.test/invitacion/abc");
  });

  /** La aprobación ya ocurrió: no se puede pintar de rojo, pero tampoco callar lo que faltó. */
  it("si el email no sale, informa la aprobación y advierte aparte", async () => {
    H.inviteOne.mockResolvedValue({ error: "El proveedor rechazó el envío." });

    const r = await approveApplicationAction(undefined, form({ applicationId: "app-1" }));

    expect(r.error).toBeNull();
    expect(r.ok).toContain("735");
    expect(r.warn).toContain("no salió");
    expect(r.warn).toContain("ficha del socio");
  });

  it("sin permiso no aprueba nada", async () => {
    H.canManage.mockResolvedValue(false);

    const r = await approveApplicationAction(undefined, form({ applicationId: "app-1" }));

    expect(r.error).toContain("permiso");
    expect(H.approve).not.toHaveBeenCalled();
    expect(H.inviteOne).not.toHaveBeenCalled();
  });

  it("si la aprobación falla, no se invita a nadie", async () => {
    const { ApprovalError } = await import("@/lib/membership/approve");
    H.approve.mockRejectedValue(new ApprovalError("ESTADO_INVALIDO", "Ya fue resuelta."));

    const r = await approveApplicationAction(undefined, form({ applicationId: "app-1" }));

    expect(r.error).toBe("Ya fue resuelta.");
    expect(H.inviteOne).not.toHaveBeenCalled();
  });
});

describe("rechazar", () => {
  it("le comunica el motivo a la persona", async () => {
    const r = await rejectApplicationAction(
      undefined,
      form({ applicationId: "app-1", reason: "Falta el certificado de alumno regular." }),
    );

    const [args] = H.sendAndLog.mock.calls[0] as [{ to: string; body: { text: string } }];
    expect(args.to).toBe("ana@test.com");
    expect(args.body.text).toContain("Falta el certificado de alumno regular.");
    expect(r.error).toBeNull();
  });

  it("si el aviso no sale, lo dice: el motivo guardado sin comunicar no sirve de nada", async () => {
    H.sendAndLog.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422" });

    const r = await rejectApplicationAction(
      undefined,
      form({ applicationId: "app-1", reason: "Falta el certificado." }),
    );

    expect(r.ok).toContain("rechazada");
    expect(r.warn).toContain("ana@test.com");
  });

  it("sin motivo no manda ningún email", async () => {
    const { ApprovalError } = await import("@/lib/membership/approve");
    H.reject.mockRejectedValue(new ApprovalError("ESTADO_INVALIDO", "El rechazo necesita un motivo."));

    const r = await rejectApplicationAction(undefined, form({ applicationId: "app-1", reason: " " }));

    expect(r.error).toContain("motivo");
    expect(H.sendAndLog).not.toHaveBeenCalled();
  });
});
