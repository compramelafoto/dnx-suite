import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findFirst: vi.fn(), count: vi.fn() },
  culturalActivityWork: { findFirst: vi.fn() },
  $executeRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { POST } = await import("@/app/api/visitas/route");
const { LIMITES_PUBLICOS, resetRateLimit } = await import("@/lib/limite");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const enviar = (cuerpo: unknown, ua = UA) =>
  POST(new Request("http://localhost:3014/api/visitas", { method: "POST", body: JSON.stringify(cuerpo), headers: { "user-agent": ua, "content-type": "application/json" } }));

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.$executeRaw.mockResolvedValue(1);
  db.culturalActivity.findFirst.mockResolvedValue({ id: "cka1b2c3d4" });
  db.culturalActivity.count.mockResolvedValue(0);
  db.culturalActivityWork.findFirst.mockResolvedValue({ id: "ckw1b2c3d4" });
});

describe("POST /api/visitas", () => {
  it("cuenta la visita a la muestra y a una obra", async () => {
    expect((await enviar({ a: "cka1b2c3d4" })).status).toBe(204);
    expect((await enviar({ a: "cka1b2c3d4", o: "ckw1b2c3d4" })).status).toBe(204);
    expect(db.$executeRaw.mock.calls.map((c) => [c[1], c[2], c[4]])).toEqual([["cka1b2c3d4", "", "VIEW"], ["cka1b2c3d4", "ckw1b2c3d4", "VIEW"]]);
  });
  it("siempre 204 y no cuenta lo que no corresponde", async () => {
    db.culturalActivityWork.findFirst.mockResolvedValue(null);
    expect((await enviar({ a: "cka1b2c3d4", o: "ajena12345" })).status).toBe(204);
    expect((await enviar({ a: "mal formado!" })).status).toBe(204);
    expect((await enviar("no es json")).status).toBe(204);
    expect((await enviar({ a: "cka1b2c3d4" }, "curl/8.0")).status).toBe(204);
    // Alguien del equipo de la muestra (dueño o integrante activo): no cuenta.
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    db.culturalActivity.count.mockResolvedValue(1);
    expect((await enviar({ a: "cka1b2c3d4" })).status).toBe(204);
    expect(db.culturalActivity.count.mock.calls[0]![0].where).toMatchObject({ id: "cka1b2c3d4" });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("una persona con sesión que no es del equipo sí cuenta", async () => {
    usuarioActual.valor = { id: 8, esSuperAdmin: false };
    db.culturalActivity.count.mockResolvedValue(0);
    await enviar({ a: "cka1b2c3d4" });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });
  it("la misma página desde la misma IP cuenta hasta 30 veces cada 10 minutos; otra página sigue", async () => {
    for (let i = 0; i < 35; i++) await enviar({ a: "cka1b2c3d4", o: "ckw1b2c3d4" });
    expect(db.$executeRaw).toHaveBeenCalledTimes(LIMITES_PUBLICOS.visitasPorPagina.limit);
    await enviar({ a: "cka1b2c3d4" });
    expect(db.$executeRaw).toHaveBeenCalledTimes(LIMITES_PUBLICOS.visitasPorPagina.limit + 1);
  });
  it("un cuerpo de más de 1000 bytes no se cuenta, venga o no content-length", async () => {
    // JSON válido seguido de espacios: cortado a 1000 bytes seguiría siendo válido.
    const grande = `${JSON.stringify({ a: "cka1b2c3d4" })}${" ".repeat(2000)}`;
    const sinLargo = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(grande));
        c.close();
      },
    });
    const r = await POST(new Request("http://localhost:3014/api/visitas", {
      method: "POST", body: sinLargo, headers: { "user-agent": UA }, duplex: "half",
    } as RequestInit & { duplex: "half" }));
    expect(r.status).toBe(204);
    expect((await POST(new Request("http://localhost:3014/api/visitas", { method: "POST", body: grande, headers: { "user-agent": UA } }))).status).toBe(204);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("acepta el cuerpo como texto plano (lo que manda la baliza)", async () => {
    await POST(new Request("http://localhost:3014/api/visitas", { method: "POST", body: JSON.stringify({ a: "cka1b2c3d4" }), headers: { "user-agent": UA, "content-type": "text/plain;charset=UTF-8" } }));
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
