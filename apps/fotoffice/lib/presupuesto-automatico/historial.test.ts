import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { eventosDeFila } = await import("./historial");

const FILA = {
  id: "a1", presupuestoId: "p1", status: "ENVIADO", telegramMessageId: null, errorCode: null,
  channels: { correo: "SIN_CORREO", whatsapp: "ENVIADO" }, approvedAt: new Date("2026-11-20T15:00:00Z"),
  sentAt: new Date("2026-11-20T15:00:01Z"), createdAt: new Date("2026-11-20T14:59:59Z"),
};

describe("historial de la cotización automática", () => {
  it("la del paquete estándar dice que la envió el bot sola, sin aprobación", () => {
    const e = eventosDeFila({ ...FILA, approvedVia: "BOT" }, "l1");
    expect(e[1]!.texto).toMatch(/^El bot la envió sola con el paquete que eligió el cliente: /);
  });

  it("las aprobadas siguen diciendo por dónde", () => {
    expect(eventosDeFila({ ...FILA, approvedVia: "PANEL" }, "l1")[1]!.texto).toMatch(/^Se aprobó desde FOTOFFICE: /);
    expect(eventosDeFila({ ...FILA, approvedVia: "TELEGRAM" }, "l1")[1]!.texto).toMatch(/^Se aprobó por Telegram: /);
  });
});
