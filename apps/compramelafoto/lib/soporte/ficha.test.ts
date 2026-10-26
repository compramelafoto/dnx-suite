import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ticket: vi.fn(), notas: vi.fn(), acciones: vi.fn(), historia: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    supportTicket: { findUnique: (...a: unknown[]) => m.ticket(...a) },
    supportMessage: { findMany: (...a: unknown[]) => m.notas(...a) },
    botAction: { findMany: (...a: unknown[]) => m.acciones(...a) },
  },
}));
vi.mock("./caso-bot", () => ({ historiaDeCaso: (...a: unknown[]) => m.historia(...a) }));
import { cargarFicha } from "./ficha";

const now = new Date("2026-10-26T12:00:00Z");
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.ticket.mockResolvedValue({
    id: 60, status: "OPEN", reason: "PAYMENT_FAILED", description: "No puede pagar", requesterName: "Ana", requesterEmail: "ana@x.com", requesterRole: "CUSTOMER",
    createdAt: new Date("2026-10-25T17:00:00Z"), slaDesde: null,
    diagnostico: { estado: "LISTO", categoria: "SE_ACLARA_CON_DATOS", resumen: "r", hallazgos: "h", respuestaSugerida: "s", acciones: [{ herramienta: "reenviar_link_pack", input: {}, motivo: "m", tildada: true }], confianza: "ALTA", mailSinVerificar: true, error: null },
  });
  m.notas.mockResolvedValue([{ message: "Derivado por DNX Bot.\n\nUsuario: hola", authorName: "DNX Bot", createdAt: new Date(0) }]);
  m.acciones.mockResolvedValue([{ toolName: "reenviar_link_pack", status: "EXECUTED", resultMessage: "Listo", createdAt: new Date(1) }]);
  m.historia.mockResolvedValue({ ticket: { id: 60, estado: "OPEN" }, items: [{ rol: "usuario", texto: "hola", autor: null, fecha: "x" }] });
});

describe("cargarFicha", () => {
  it("junta el ticket, el reloj, el diagnóstico, la historia, las notas internas y lo aplicado", async () => {
    const f = await cargarFicha(60, now);
    expect(f).toMatchObject({
      ticket: { id: 60, requesterEmail: "ana@x.com" },
      reloj: { color: "amarillo" },
      diagnostico: { estado: "LISTO", mailSinVerificar: true, acciones: [{ herramienta: "reenviar_link_pack" }] },
      historia: [{ rol: "usuario", texto: "hola" }],
      notas: [{ texto: "Derivado por DNX Bot.\n\nUsuario: hola", autor: "DNX Bot" }],
      acciones: [{ toolName: "reenviar_link_pack", status: "EXECUTED" }],
    });
    // Las notas no incluyen la reserva provisoria de una respuesta en curso.
    expect(m.notas.mock.calls[0]![0].where).toMatchObject({ ticketId: 60, isInternal: true, NOT: { origen: "SISTEMA" } });
    expect(m.acciones.mock.calls[0]![0].where.summary).toEqual({ endsWith: "desde el ticket #60" });
  });
  it("inexistente → null", async () => {
    m.ticket.mockResolvedValue(null);
    expect(await cargarFicha(1, now)).toBeNull();
  });
});
