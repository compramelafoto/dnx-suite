import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La acción completa de invitar, de punta a punta y sin red.
 *
 * Cubre la costura que los tests de unidad no tocaban: crear la invitación, armar la URL
 * absoluta, cargar la firma, enviar, y registrar el desenlace del envío como un evento aparte.
 */

const {
  getMemberMock,
  createInvitationMock,
  markDeliveryMock,
  revokeMock,
  loadContextMock,
  sendMock,
  requireManageMock,
} = vi.hoisted(() => ({
  getMemberMock: vi.fn(),
  createInvitationMock: vi.fn(),
  markDeliveryMock: vi.fn(),
  revokeMock: vi.fn(),
  loadContextMock: vi.fn(),
  sendMock: vi.fn(),
  requireManageMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@repo/db/fotoffice-members", () => ({
  getMember: getMemberMock,
  createMemberInvitation: createInvitationMock,
  markMemberInvitationDelivery: markDeliveryMock,
  revokeMemberInvitation: revokeMock,
  linkMemberToUser: vi.fn(),
  unlinkMemberFromUser: vi.fn(),
  MemberConcurrencyError: class extends Error {},
  MemberLinkError: class extends Error {
    constructor(readonly reason: string) {
      super(reason);
    }
  },
}));

vi.mock("@repo/db/fotoffice-user-lookup", () => ({ findLinkableUserByEmail: vi.fn() }));

vi.mock("@/lib/members/access", () => ({ requireMembersManageContext: requireManageMock }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: loadContextMock,
}));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: sendMock }));

const { inviteMemberAction, revokeMemberInvitationAction } = await import("./member-access");

const SIGNATURE = { html: "<table>marca-de-firma</table>", text: "marca-de-firma" };

function form(memberId = "mem-1") {
  const fd = new FormData();
  fd.set("memberId", memberId);
  return fd;
}

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://fotoffice.com");
  requireManageMock.mockReset().mockResolvedValue({
    workspace: { id: "ws-sfpr", name: "Club SFPR" },
    user: { id: 7, email: "admin@sfpr.test", name: "Admin" },
    canManage: true,
  });
  getMemberMock.mockReset().mockResolvedValue({
    id: "mem-1",
    firstName: "Juan",
    email: "socio@example.com",
    status: "ACTIVE",
    userId: null,
    updatedAt: new Date(),
  });
  createInvitationMock.mockReset().mockResolvedValue({
    invitation: { id: "inv-1" },
    resend: false,
  });
  markDeliveryMock.mockReset().mockResolvedValue(undefined);
  revokeMock.mockReset().mockResolvedValue({ count: 1 });
  loadContextMock.mockReset().mockResolvedValue({
    organizationName: "Club SFPR",
    signature: SIGNATURE,
  });
  sendMock.mockReset().mockResolvedValue({ status: "SENT", providerId: "email_1" });
});

afterEach(() => vi.unstubAllEnvs());

describe("envío exitoso", () => {
  it("crea la invitación con hash, vencimiento y actor", async () => {
    await inviteMemberAction(undefined, form());
    const [workspaceId, memberId, input] = createInvitationMock.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(workspaceId).toBe("ws-sfpr");
    expect(memberId).toBe("mem-1");
    expect(String(input.tokenHash)).toMatch(/^[a-f0-9]{64}$/);
    expect(input.expiresAt).toBeInstanceOf(Date);
    expect(input.actor).toBeTruthy();
    // El token en claro nunca se le pasa a la base.
    expect(JSON.stringify(input)).not.toContain("tokenPlano");
  });

  it("arma la URL absoluta sobre APP_URL", async () => {
    await inviteMemberAction(undefined, form());
    const message = sendMock.mock.calls[0]?.[0];
    expect(message.html).toContain("https://fotoffice.com/invitacion/");
    expect(message.text).toContain("https://fotoffice.com/invitacion/");
  });

  it("usa la firma del workspace, una sola vez en HTML y en texto", async () => {
    await inviteMemberAction(undefined, form());
    const message = sendMock.mock.calls[0]?.[0];
    expect((message.html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
    expect(message.text.split("marca-de-firma").length - 1).toBe(1);
    expect(message.subject).toBe("Club SFPR te invita a acceder a FotoOffice");
    expect(message.to).toBe("socio@example.com");
  });

  it("marca sentAt cuando el proveedor acepta", async () => {
    const state = await inviteMemberAction(undefined, form());
    expect(state.ok).toBe(true);
    expect(state.sentTo).toBe("socio@example.com");
    const [, , , outcome] = markDeliveryMock.mock.calls[0] as [string, string, string, { sent: boolean; resend: boolean }];
    expect(outcome.sent).toBe(true);
    expect(outcome.resend).toBe(false);
  });

  it("un reenvío se registra como tal", async () => {
    createInvitationMock.mockResolvedValue({ invitation: { id: "inv-2" }, resend: true });
    await inviteMemberAction(undefined, form());
    const [, , , outcome] = markDeliveryMock.mock.calls[0] as [string, string, string, { resend: boolean }];
    expect(outcome.resend).toBe(true);
  });
});

describe("fallo de envío", () => {
  beforeEach(() => {
    sendMock.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422 · validation_error" });
  });

  it("marca sendFailedAt y NO lo presenta como enviado", async () => {
    const state = await inviteMemberAction(undefined, form());
    expect(state.ok).toBeUndefined();
    expect(state.sentTo).toBeUndefined();
    expect(state.error).toContain("no salió");

    const [, , , outcome] = markDeliveryMock.mock.calls[0] as [string, string, string, { sent: boolean; detail: string }];
    expect(outcome.sent).toBe(false);
    expect(outcome.detail).toContain("422");
  });

  it("queda reintentable: la invitación se creó igual", async () => {
    await inviteMemberAction(undefined, form());
    expect(createInvitationMock).toHaveBeenCalledTimes(1);
    expect(markDeliveryMock).toHaveBeenCalledTimes(1);
  });

  it("no le muestra al administrador el detalle del proveedor", async () => {
    const state = await inviteMemberAction(undefined, form());
    expect(state.error).not.toContain("validation_error");
    expect(state.error).not.toContain("422");
  });
});

describe("guardas previas", () => {
  it("sin APP_URL no crea nada", async () => {
    vi.stubEnv("APP_URL", "");
    const state = await inviteMemberAction(undefined, form());
    expect(state.error).toContain("configuración");
    expect(createInvitationMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it.each(["SUSPENDED", "INACTIVE"])("un socio %s no se puede invitar", async (status) => {
    getMemberMock.mockResolvedValue({ id: "mem-1", email: "s@x.test", status, userId: null });
    const state = await inviteMemberAction(undefined, form());
    expect(state.error).toContain("activo");
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it("sin email del socio no se inventa uno", async () => {
    getMemberMock.mockResolvedValue({ id: "mem-1", email: null, status: "ACTIVE", userId: null });
    const state = await inviteMemberAction(undefined, form());
    expect(state.error).toContain("no tiene email");
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it("un socio ya vinculado no se invita", async () => {
    getMemberMock.mockResolvedValue({ id: "mem-1", email: "s@x.test", status: "ACTIVE", userId: 5 });
    const state = await inviteMemberAction(undefined, form());
    expect(state.error).toContain("ya tiene una cuenta");
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  /** La autorización vive en `requireMembersManageContext`, que STAFF no supera. */
  it("la acción pasa siempre por el contexto que exige OWNER/ADMIN", async () => {
    await inviteMemberAction(undefined, form());
    expect(requireManageMock).toHaveBeenCalledTimes(1);
  });
});

describe("revocación", () => {
  it("pasa el actor para que quede auditada", async () => {
    const fd = form();
    fd.set("invitationId", "inv-1");
    const state = await revokeMemberInvitationAction(undefined, fd);
    expect(state.ok).toBe(true);
    expect(revokeMock.mock.calls[0]?.[3]).toBeTruthy();
  });

  it("revocar algo que ya no estaba pendiente se informa sin auditar de más", async () => {
    revokeMock.mockResolvedValue({ count: 0 });
    const fd = form();
    fd.set("invitationId", "inv-1");
    const state = await revokeMemberInvitationAction(undefined, fd);
    expect(state.error).toContain("ya no estaba pendiente");
  });
});

describe("sin red real", () => {
  it("el transporte está sustituido: no hay llamadas a Resend", async () => {
    await inviteMemberAction(undefined, form());
    expect(sendMock).toHaveBeenCalledTimes(1);
    // `sendTransactionalEmail` está mockeado; ningún fetch sale de este proceso.
  });
});
