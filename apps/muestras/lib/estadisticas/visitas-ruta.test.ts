import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findFirst: vi.fn() },
  culturalActivityWork: { findFirst: vi.fn() },
  $executeRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { POST } = await import("@/app/api/visitas/route");
const { resetRateLimit } = await import("@/lib/limite");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const enviar = (cuerpo: unknown, ua = UA) =>
  POST(new Request("http://localhost:3014/api/visitas", { method: "POST", body: JSON.stringify(cuerpo), headers: { "user-agent": ua, "content-type": "application/json" } }));

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.$executeRaw.mockResolvedValue(1);
  db.culturalActivity.findFirst.mockResolvedValue({ id: "cka1b2c3d4", proposedByUserId: 7 });
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
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    expect((await enviar({ a: "cka1b2c3d4" })).status).toBe(204);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
