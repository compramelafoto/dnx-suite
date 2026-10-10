import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivityWork: { findUnique: vi.fn() },
  culturalActivity: { findUnique: vi.fn() },
  $executeRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { GET, HEAD } = await import("@/app/q/[tipo]/[id]/route");
const { resetRateLimit } = await import("@/lib/limite");

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36";
const pedir = (tipo: string, id: string, ua = UA) =>
  GET(new Request(`http://localhost:3014/q/${tipo}/${id}`, { headers: { "user-agent": ua, "x-forwarded-for": "1.1.1.1" } }), { params: Promise.resolve({ tipo, id }) });
const muestra = { id: "a1", slug: "miradas-abc", reviewStatus: "APPROVED", type: "MUESTRA", proposedByUserId: 7 };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.$executeRaw.mockResolvedValue(1);
  db.culturalActivityWork.findUnique.mockResolvedValue({ id: "w1", activity: muestra });
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
});

describe("GET /q/[tipo]/[id]", () => {
  it("la ficha de una obra cuenta un escaneo y lleva a la obra, sin caché", async () => {
    const r = await pedir("o", "w1");
    expect(r.status).toBe(302);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/m/miradas-abc/o/w1");
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(db.$executeRaw.mock.calls[0]!.slice(1)).toEqual(["a1", "w1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "SCAN"]);
  });
  it("el cartel lleva a la muestra y el afiche al libro", async () => {
    expect(new URL((await pedir("m", "a1")).headers.get("location")!).pathname).toBe("/m/miradas-abc");
    const libro = await pedir("l", "a1");
    expect(new URL(libro.headers.get("location")!).pathname).toBe("/m/miradas-abc/libro");
    expect(db.$executeRaw.mock.calls[1]!.slice(1)).toEqual(["a1", "", expect.any(String), "GUESTBOOK_SCAN"]);
  });
  it("un robot o el organizador no cuentan, pero igual redirige", async () => {
    expect((await pedir("o", "w1", "facebookexternalhit/1.1")).status).toBe(302);
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    expect((await pedir("o", "w1")).status).toBe(302);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("algo despublicado, inexistente o mal formado va a la portada sin contar", async () => {
    db.culturalActivityWork.findUnique.mockResolvedValue({ id: "w1", activity: { ...muestra, reviewStatus: "UNPUBLISHED" } });
    expect(new URL((await pedir("o", "w1")).headers.get("location")!).pathname).toBe("/");
    db.culturalActivity.findUnique.mockResolvedValue(null);
    expect(new URL((await pedir("m", "nada")).headers.get("location")!).pathname).toBe("/");
    expect(new URL((await pedir("x", "a1")).headers.get("location")!).pathname).toBe("/");
    expect(new URL((await pedir("o", "../../etc")).headers.get("location")!).pathname).toBe("/");
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("si contar falla, la redirección anda igual", async () => {
    db.$executeRaw.mockRejectedValue(new Error("base caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await pedir("o", "w1")).status).toBe(302);
    error.mockRestore();
  });
  it("HEAD redirige sin contar", async () => {
    const r = await HEAD(new Request("http://localhost:3014/q/o/w1", { method: "HEAD", headers: { "user-agent": UA } }), { params: Promise.resolve({ tipo: "o", id: "w1" }) });
    expect(r.status).toBe(302);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
