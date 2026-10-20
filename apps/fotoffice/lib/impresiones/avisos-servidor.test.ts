import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
const H = vi.hoisted(() => ({
  pedido: vi.fn(async (..._a: unknown[]) => null as unknown),
  branding: vi.fn(async (..._a: unknown[]) => ({ publicSlug: "dnxestudio", commercialName: "DNX <Estudio>" }) as unknown),
  enviar: vi.fn(async (..._a: unknown[]) => ({ status: "SENT", providerId: "x" })),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: { fotofficePrintOrder: { findFirst: H.pedido }, fotofficeWorkspaceBranding: { findUnique: H.branding } } }));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.enviar }));
vi.mock("@/lib/communications/load-workspace-sender", () => ({ loadWorkspaceSender: vi.fn(async () => ({ name: "DNX", replyTo: null })) }));
process.env.NEXT_PUBLIC_APP_URL = "https://app.test/";
const { avisarPedidoConfirmado } = await import("./avisos-servidor");

const pedido = {
  id: "ord1", number: 8, nombre: "Juan <b>", email: "j@t.com", trackingToken: "trk", promisedAt: new Date("2026-10-22T12:00:00Z"),
  items: [{ quantity: 2 }, { quantity: 1 }],
};

beforeEach(() => vi.clearAllMocks());

describe("avisarPedidoConfirmado", () => {
  it("manda copias, fecha y enlace, con el nombre escapado en el HTML", async () => {
    H.pedido.mockResolvedValue(pedido);
    await avisarPedidoConfirmado("ws", "ord1");
    expect(H.pedido).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ord1", workspaceId: "ws" } }));
    const m = H.enviar.mock.calls[0][0] as unknown as { to: string; subject: string; text: string; html: string };
    expect(m.to).toBe("j@t.com");
    expect(m.subject).toBe("Recibimos tu pedido de copias (8)");
    expect(m.text).toContain("3 copias");
    expect(m.text).toContain("22/10/2026");
    expect(m.text).toContain("https://app.test/w/dnxestudio/impresion/trk");
    expect(m.html).toContain("Juan &lt;b&gt;");
    expect(m.html).not.toContain("Juan <b>");
    expect(m.html).toContain("DNX &lt;Estudio&gt;");
  });
  it("sin pedido no manda nada", async () => {
    H.pedido.mockResolvedValue(null);
    await avisarPedidoConfirmado("ws", "ord1");
    expect(H.enviar).not.toHaveBeenCalled();
  });
  it("nunca lanza", async () => {
    H.pedido.mockRejectedValue(new Error("base caída"));
    await expect(avisarPedidoConfirmado("ws", "ord1")).resolves.toBeUndefined();
  });
});
