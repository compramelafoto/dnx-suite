import { describe, expect, it, vi } from "vitest";
import { obtenerTicket, type DepositoTicket } from "./ticket";
import type { Ticket } from "./wsaa";

const AHORA = new Date("2026-10-25T15:00:00Z");
const t = (horas: number): Ticket => ({
  token: `tok${horas}`,
  sign: "s",
  generationTime: AHORA,
  expirationTime: new Date(AHORA.getTime() + horas * 3_600_000),
});

function deposito(inicial: Ticket | null): DepositoTicket & { valor: Ticket | null } {
  return {
    valor: inicial,
    async leer() {
      return this.valor;
    },
    async guardar(x) {
      this.valor = x;
    },
  };
}

describe("ticket de WSAA", () => {
  it("usa el guardado si sigue vigente, sin pedir otro", async () => {
    const pedir = vi.fn();
    const r = await obtenerTicket({ deposito: deposito(t(5)), pedir, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, nuevo: false });
    expect(pedir).not.toHaveBeenCalled();
  });

  it("pide y guarda uno nuevo si falta o está por vencer", async () => {
    const d = deposito(t(0.1));
    const r = await obtenerTicket({ deposito: d, pedir: async () => ({ ok: true, ticket: t(12) }), ahora: AHORA });
    expect(r).toMatchObject({ ok: true, nuevo: true });
    expect(d.valor!.token).toBe("tok12");
  });

  it("si ARCA dice que ya hay uno vigente, usa el guardado aunque esté cerca de vencer", async () => {
    const r = await obtenerTicket({ deposito: deposito(t(0.1)), pedir: async () => ({ ok: false, motivo: "YA_AUTENTICADO", mensaje: "x" }), ahora: AHORA });
    expect(r).toMatchObject({ ok: true, ticket: { token: "tok0.1" } });
  });

  it("si ARCA dice que ya hay uno y no lo tenemos, lo explica", async () => {
    const r = await obtenerTicket({ deposito: deposito(null), pedir: async () => ({ ok: false, motivo: "YA_AUTENTICADO", mensaje: "x" }), ahora: AHORA });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensaje).toContain("12 horas");
  });
});
