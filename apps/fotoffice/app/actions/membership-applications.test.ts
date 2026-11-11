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
  vocabulary: vi.fn(),
  branding: vi.fn(),
  cobros: vi.fn(),
  enrollment: vi.fn(),
  applicationFindFirst: vi.fn(),
  applicationCreate: vi.fn(),
  memberFindFirst: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      fotofficeWorkspaceBranding: { findUnique: H.branding },
      membershipApplication: { findFirst: H.applicationFindFirst, create: H.applicationCreate },
      member: { findFirst: H.memberFindFirst, findUnique: vi.fn() },
    },
  };
});
vi.mock("@/lib/workspace", () => ({ requireActiveWorkspace: H.requireWorkspace }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.canManage }));
vi.mock("@/lib/payments/connect/status", () => ({ getWorkspaceCollectionStatus: H.cobros }));
vi.mock("@/lib/membership/enrollment-store", () => ({ getEnrollmentSettings: H.enrollment }));
vi.mock("@/lib/membership/repository", () => ({
  approveApplication: H.approve,
  rejectApplication: H.reject,
}));
vi.mock("@/lib/members/invite-member", () => ({ inviteOneMember: H.inviteOne }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: H.sendAndLog }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: H.emailContext,
}));
// Cómo llama esta institución a la gente de su padrón: el resumen del alta la nombra.
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: H.vocabulary }));

const { approveApplicationAction, rejectApplicationAction, submitApplicationAction } = await import(
  "./membership-applications"
);
const { personVocabulary } = await import("@/lib/vocabulario/personas");

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
  H.vocabulary.mockReset().mockResolvedValue(personVocabulary(null));
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

describe("alta corta con elección de plan", () => {
  // Los planes ya vienen filtrados por institución y activos desde `getEnrollmentSettings`.
  const plan = (over: Record<string, unknown> & { id: string }) => ({
    name: over.id,
    description: null,
    order: 0,
    selfRenew: false,
    includesMonthlyBox: false,
    bookingCreditsPerPayment: 0,
    bookingCreditLabel: null,
    ...over,
  });
  const VIP = plan({ id: "vip", name: "VIP", selfRenew: true, bookingCreditsPerPayment: 4, bookingCreditLabel: "cortes" });
  const BOX = plan({ id: "box", name: "Club con BOX", order: 1, includesMonthlyBox: true });
  const DATOS = { firstName: "Ana", lastName: "Pérez", email: "ana@test.com" };
  const DOMICILIO = { address: "San Martín 1234", city: "Rosario", province: "Santa Fe", postalCode: "2000" };

  function alta(over: Record<string, unknown> = {}) {
    return {
      autoApprove: false,
      simpleForm: true,
      category: { id: "vip", name: "VIP", description: null },
      plans: [VIP],
      ...over,
    };
  }

  const creada = () => H.applicationCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined;

  beforeEach(() => {
    H.branding.mockReset().mockResolvedValue({ workspaceId: "ws-club", contactEmail: null });
    H.cobros.mockReset().mockResolvedValue({ canCharge: true });
    H.enrollment.mockReset().mockResolvedValue(alta());
    H.applicationFindFirst.mockReset().mockResolvedValue(null);
    H.applicationCreate.mockReset().mockResolvedValue({ id: "sol-1" });
    H.memberFindFirst.mockReset().mockResolvedValue(null);
  });

  it("con una sola categoría de altas funciona como siempre, aunque no llegue el plan", async () => {
    const r = await submitApplicationAction("club", undefined, form(DATOS));

    expect(r.error).toBeNull();
    expect(creada()?.data).toEqual(
      expect.objectContaining({ categoryId: "vip", noticeAddress: expect.stringMatching(/No corresponde/), city: null }),
    );
  });

  it("guarda el plan elegido, no el de las altas", async () => {
    H.enrollment.mockResolvedValue(alta({ plans: [VIP, BOX] }));

    const r = await submitApplicationAction("club", undefined, form({ ...DATOS, ...DOMICILIO, planId: "box" }));

    expect(r.error).toBeNull();
    expect(creada()?.data).toEqual(
      expect.objectContaining({
        categoryId: "box",
        noticeAddress: "San Martín 1234",
        city: "Rosario",
        province: "Santa Fe",
        postalCode: "2000",
      }),
    );
  });

  it("un plan que no se ofrece se rechaza: el id del navegador no alcanza", async () => {
    H.enrollment.mockResolvedValue(alta({ plans: [VIP, BOX] }));

    const r = await submitApplicationAction("club", undefined, form({ ...DATOS, planId: "categoria-de-otra-institucion" }));

    expect(r.error).toContain("no está disponible");
    expect(H.applicationCreate).not.toHaveBeenCalled();
  });

  it("con varios planes, sin elegir no entra", async () => {
    H.enrollment.mockResolvedValue(alta({ plans: [VIP, BOX] }));

    const r = await submitApplicationAction("club", undefined, form(DATOS));

    expect(r.error).toBe("Elegí un plan.");
    expect(H.applicationCreate).not.toHaveBeenCalled();
  });

  it("con BOX, sin domicilio no entra", async () => {
    H.enrollment.mockResolvedValue(alta({ plans: [VIP, BOX] }));

    const r = await submitApplicationAction("club", undefined, form({ ...DATOS, ...DOMICILIO, planId: "box", postalCode: "" }));

    expect(r.error).toBe("Falta el código postal.");
    expect(H.applicationCreate).not.toHaveBeenCalled();
  });

  it("sin BOX, el domicilio que llegue no se guarda", async () => {
    H.enrollment.mockResolvedValue(alta({ plans: [VIP, BOX] }));

    await submitApplicationAction("club", undefined, form({ ...DATOS, ...DOMICILIO, planId: "vip" }));

    expect(creada()?.data).toEqual(expect.objectContaining({ categoryId: "vip", city: null, postalCode: null }));
  });

  it("el formulario completo no mira los planes: sigue con la categoría de las altas", async () => {
    H.enrollment.mockResolvedValue(alta({ simpleForm: false, plans: [VIP, BOX] }));

    const r = await submitApplicationAction(
      "club",
      undefined,
      form({ ...DATOS, noticeAddress: "Mitre 50", declaredFeeScale: "PLENA", planId: "box" }),
    );

    expect(r.error).toBeNull();
    expect(creada()?.data).toEqual(expect.objectContaining({ categoryId: "vip", noticeAddress: "Mitre 50" }));
  });
});
