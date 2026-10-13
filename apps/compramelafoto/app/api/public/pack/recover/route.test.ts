import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), token: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findMany: (...a: unknown[]) => m.find(...a) } },
  OrderOrigin: { PREVENTA_PACK: "PREVENTA_PACK" },
  OrderStatus: { PAID: "PAID" },
}));
vi.mock("@/lib/preventa-canjeable/pack-access-tokens", () => ({
  createPackAccessTokenForOrder: (...a: unknown[]) => m.token(...a),
}));
vi.mock("@/lib/order-confirmation-email", () => ({
  queuePreventaPackRecoveryEmail: (...a: unknown[]) => m.mail(...a),
}));
import { POST } from "./route";

const req = (body: unknown, ip?: string) =>
  new Request("http://x/api/public/pack/recover", {
    method: "POST",
    body: JSON.stringify(body),
    headers: ip ? { "x-forwarded-for": `${ip}, 10.0.0.1` } : {},
  });
const GENERICA = { ok: true, message: "Si encontramos pedidos con ese email, te enviamos un link." };
beforeEach(() => {
  m.find.mockReset();
  m.token.mockReset();
  m.mail.mockReset();
});

describe("POST /api/public/pack/recover", () => {
  it("mail inválido → respuesta genérica sin consultar", async () => {
    const r = await POST(req({ email: "nada" }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, message: "Si encontramos pedidos con ese email, te enviamos un link." });
    expect(m.find).not.toHaveBeenCalled();
  });
  it("sin pedidos → misma respuesta y sin mail", async () => {
    m.find.mockResolvedValue([]);
    const r = await POST(req({ email: "a@b.com" }));
    expect(r.status).toBe(200);
    expect((await r.json()).message).toBe("Si encontramos pedidos con ese email, te enviamos un link.");
    expect(m.mail).not.toHaveBeenCalled();
  });
  it("con pedidos → token nuevo revocando el anterior y un mail con los packs", async () => {
    m.find.mockResolvedValue([{ id: 5, album: { title: "Egresados" } }]);
    m.token.mockResolvedValue({ token: "tok" });
    const r = await POST(req({ email: "A@B.com" }));
    expect(r.status).toBe(200);
    expect((await r.json()).message).toBe("Si encontramos pedidos con ese email, te enviamos un link.");
    expect(m.token).toHaveBeenCalledWith(5, { revokeExisting: true });
    expect(m.mail).toHaveBeenCalledWith({
      email: "a@b.com",
      packs: [
        expect.objectContaining({
          orderId: 5,
          albumTitle: "Egresados",
          packAccessUrl: expect.stringContaining("/cliente/pack/tok"),
        }),
      ],
    });
  });

  // El limitador es real (memoria del módulo): cada caso usa IPs y mails propios.
  it("límite por email: 3 por hora; el 4º recibe la misma respuesta genérica y no consulta", async () => {
    m.find.mockResolvedValue([]);
    for (let i = 0; i < 3; i++) {
      const r = await POST(req({ email: "Victima@Mail.com " }, `20.0.0.${i}`));
      expect(r.status).toBe(200);
    }
    expect(m.find).toHaveBeenCalledTimes(3);
    const limitado = await POST(req({ email: "victima@mail.com" }, "20.0.0.99"));
    expect(limitado.status).toBe(200);
    expect(await limitado.json()).toEqual(GENERICA);
    expect(m.find).toHaveBeenCalledTimes(3);
    expect(m.mail).not.toHaveBeenCalled();
  });
  it("límite por IP: 10 por hora; el 11º recibe 429 sin consultar ni nombrar el email", async () => {
    m.find.mockResolvedValue([]);
    for (let i = 0; i < 10; i++) {
      const r = await POST(req({ email: `barrido${i}@mail.com` }, "30.0.0.1"));
      expect(r.status).toBe(200);
    }
    const limitado = await POST(req({ email: "otro@mail.com" }, "30.0.0.1"));
    expect(limitado.status).toBe(429);
    const cuerpo = await limitado.json();
    expect(cuerpo).toEqual({ error: "Demasiadas solicitudes. Intentá más tarde." });
    expect(JSON.stringify(cuerpo)).not.toContain("otro@mail.com");
    expect(m.find).toHaveBeenCalledTimes(10);
    // Otra IP sigue pudiendo pedir.
    expect((await POST(req({ email: "otro@mail.com" }, "30.0.0.2"))).status).toBe(200);
  });
  it("email limitado y email inexistente responden exactamente igual", async () => {
    m.find.mockResolvedValue([]);
    const inexistente = await POST(req({ email: "nadie@mail.com" }, "40.0.0.1"));
    for (let i = 0; i < 3; i++) await POST(req({ email: "existe@mail.com" }, `40.0.1.${i}`));
    const limitado = await POST(req({ email: "existe@mail.com" }, "40.0.2.1"));
    expect(limitado.status).toBe(inexistente.status);
    expect(await limitado.json()).toEqual(await inexistente.json());
  });
});
