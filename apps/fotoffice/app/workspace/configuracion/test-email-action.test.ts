import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  membershipFindUniqueMock,
  sentEmailCountMock,
  sentEmailCreateMock,
  sendTransactionalEmailMock,
  loadContextMock,
  requireAuthMock,
} = vi.hoisted(() => ({
  membershipFindUniqueMock: vi.fn(),
  sentEmailCountMock: vi.fn(),
  sentEmailCreateMock: vi.fn(),
  sendTransactionalEmailMock: vi.fn(),
  loadContextMock: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: membershipFindUniqueMock },
    sentEmailLog: { count: sentEmailCountMock, create: sentEmailCreateMock },
    fotofficeWorkspaceBranding: { findUnique: vi.fn(), update: vi.fn() },
    workspace: { update: vi.fn(), findUnique: vi.fn() },
    fotofficePhotographerProfile: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ requireAuth: requireAuthMock }));

vi.mock("@/lib/ensure-workspace", () => ({
  ensureFotofficeWorkspaceForUser: vi.fn(async () => ({
    workspaceId: "ws-sfpr",
    created: false,
    onboardingCompleted: true,
  })),
}));

vi.mock("@/lib/communications/send-email", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: loadContextMock,
}));

const { sendTestEmailAction } = await import("./actions");

function formData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base = { to: "destino@example.com", confirm: "yes", ...overrides };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

/**
 * Marcador propio de la firma. No se usa el nombre de la organización porque ese también
 * aparece en la prosa del cuerpo, y contarlo mediría otra cosa.
 */
const SIGNATURE = { html: "<table>marca-de-firma</table>", text: "marca-de-firma" };

beforeEach(() => {
  membershipFindUniqueMock.mockReset().mockResolvedValue({ role: "WORKSPACE_OWNER" });
  sentEmailCountMock.mockReset().mockResolvedValue(0);
  sentEmailCreateMock.mockReset().mockResolvedValue({ id: 1 });
  sendTransactionalEmailMock.mockReset().mockResolvedValue({ status: "SENT", providerId: "email_1" });
  loadContextMock.mockReset().mockResolvedValue({
    organizationName: "Club SFPR",
    signature: SIGNATURE,
  });
  requireAuthMock.mockReset().mockResolvedValue({
    id: 7,
    email: "owner@sfpr.test",
    name: "Owner",
    globalRole: "USER",
  });
});

describe("autorización", () => {
  it("STAFF no puede enviar", async () => {
    membershipFindUniqueMock.mockResolvedValue({ role: "STAFF" });
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.status).toBe("FORBIDDEN");
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("sin membresía tampoco", async () => {
    membershipFindUniqueMock.mockResolvedValue(null);
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.status).toBe("FORBIDDEN");
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("OWNER y ADMIN sí", async () => {
    for (const role of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"]) {
      membershipFindUniqueMock.mockResolvedValue({ role });
      const state = await sendTestEmailAction(undefined, formData());
      expect(state.status).toBe("SENT");
    }
  });
});

describe("entrada", () => {
  it("exige confirmación explícita: un POST directo no envía", async () => {
    const state = await sendTestEmailAction(undefined, formData({ confirm: "" }));
    expect(state.status).toBe("NOT_CONFIRMED");
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("rechaza una dirección inválida", async () => {
    const state = await sendTestEmailAction(undefined, formData({ to: "no-es-un-email" }));
    expect(state.status).toBe("INVALID_EMAIL");
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("rechaza el destinatario vacío: nunca elige uno por su cuenta", async () => {
    const state = await sendTestEmailAction(undefined, formData({ to: "" }));
    expect(state.status).toBe("INVALID_EMAIL");
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it.each(["a@x.test, b@y.test", "a@x.test;b@y.test", "a@x.test b@y.test"])(
    "rechaza varios destinatarios: %s",
    async (to) => {
      const state = await sendTestEmailAction(undefined, formData({ to }));
      expect(state.status).toBe("INVALID_EMAIL");
      expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    },
  );
});

describe("límite de envíos", () => {
  it("bloquea al alcanzar el tope y no registra el intento", async () => {
    sentEmailCountMock.mockResolvedValue(99);
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.status).toBe("RATE_LIMITED");
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
    expect(sentEmailCreateMock).not.toHaveBeenCalled();
  });

  it("el SUPER_ADMIN no queda exento", async () => {
    requireAuthMock.mockResolvedValue({
      id: 7,
      email: "admin@dnx.test",
      name: "Super",
      globalRole: "SUPER_ADMIN",
    });
    sentEmailCountMock.mockResolvedValue(99);
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.status).toBe("RATE_LIMITED");
    expect(sendTransactionalEmailMock).not.toHaveBeenCalled();
  });
});

describe("envío y registro", () => {
  it("envía a la dirección ingresada, con la firma una sola vez", async () => {
    await sendTestEmailAction(undefined, formData());
    const message = sendTransactionalEmailMock.mock.calls[0]?.[0];
    expect(message.to).toBe("destino@example.com");
    expect(message.subject).toBe("Prueba de configuración de email — Club SFPR");
    expect((message.html.match(/id="fo-signature"/g) ?? []).length).toBe(1);
    expect(message.text.split("marca-de-firma").length - 1).toBe(1);
  });

  it("registra el envío asociado al usuario", async () => {
    await sendTestEmailAction(undefined, formData());
    const data = sentEmailCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.status).toBe("SENT");
    expect(data.userId).toBe(7);
    expect(data.to).toBe("destino@example.com");
  });

  it.each([
    ["CONFIGURATION_ERROR", "Faltan variables de entorno: RESEND_API_KEY"],
    ["PROVIDER_REJECTED", "HTTP 422 · validation_error · Invalid `from` field"],
    ["INTERNAL_ERROR", "socket hang up"],
  ] as const)("registra el intento fallido %s", async (status, detail) => {
    sendTransactionalEmailMock.mockResolvedValue({ status, detail });
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.status).toBe(status);
    const data = sentEmailCreateMock.mock.calls[0]?.[0]?.data;
    expect(data.status).toBe(status);
    expect(data.userId).toBe(7);
    expect(data.error).toContain(detail.slice(0, 20));
  });

  /**
   * El detalle del proveedor sirve para diagnosticar, no para mostrar: puede traer nombres
   * de campos internos o infraestructura. Queda en el log, no en la pantalla.
   */
  it("no muestra al usuario el detalle del proveedor", async () => {
    sendTransactionalEmailMock.mockResolvedValue({
      status: "PROVIDER_REJECTED",
      detail: "HTTP 422 · validation_error · Invalid `from` field",
    });
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.message).not.toContain("validation_error");
    expect(state.message).not.toContain("422");
    expect(state.message).not.toContain("from");
  });

  it("tampoco revela qué variable falta", async () => {
    sendTransactionalEmailMock.mockResolvedValue({
      status: "CONFIGURATION_ERROR",
      detail: "Faltan variables de entorno: RESEND_API_KEY",
    });
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.message).not.toContain("RESEND_API_KEY");
  });

  it("sin firma cargada el envío igual sale", async () => {
    loadContextMock.mockResolvedValue({ organizationName: "Estudio Nuevo", signature: null });
    const state = await sendTestEmailAction(undefined, formData());
    expect(state.status).toBe("SENT");
    const message = sendTransactionalEmailMock.mock.calls[0]?.[0];
    expect(message.html).not.toContain('id="fo-signature"');
  });
});
