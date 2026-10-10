import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivityWork: { findUnique: vi.fn(), findFirst: vi.fn() },
  culturalActivity: { findUnique: vi.fn(), count: vi.fn() },
  culturalActivityRoomCode: { findUnique: vi.fn() },
  culturalActivityRoomKey: { findUnique: vi.fn(), create: vi.fn() },
  $executeRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { GET, HEAD } = await import("@/app/q/[tipo]/[id]/route");
const { LIMITES_PUBLICOS, resetRateLimit } = await import("@/lib/limite");
const { firmarPase, leerPase } = await import("@/lib/sala/llave");
const LLAVE = "c".repeat(64);

const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36";
const pedir = (tipo: string, id: string, ua = UA, extra: Record<string, string> = {}, origen = "http://localhost:3014") =>
  GET(new Request(`${origen}/q/${tipo}/${id}`, { headers: { "user-agent": ua, "x-forwarded-for": "1.1.1.1", ...extra } }), { params: Promise.resolve({ tipo, id }) });
const muestra = { id: "a1", slug: "miradas-abc", reviewStatus: "APPROVED", type: "MUESTRA" };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.$executeRaw.mockResolvedValue(1);
  db.culturalActivityWork.findUnique.mockResolvedValue({ id: "w1", activity: muestra });
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
  db.culturalActivity.count.mockResolvedValue(0);
  db.culturalActivityRoomCode.findUnique.mockImplementation(async ({ where }: { where: { code: string } }) =>
    ({ abcdefghjkmn: { workId: "w1", activity: muestra }, nmkjhgfedcba: { workId: "w2", activity: muestra } } as Record<string, unknown>)[where.code] ?? null);
  db.culturalActivityWork.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id }));
  db.culturalActivityRoomKey.findUnique.mockResolvedValue({ secret: LLAVE });
});

describe("GET /q/[tipo]/[id]", () => {
  it("la ficha de una obra cuenta un escaneo y lleva a la obra, sin caché", async () => {
    const r = await pedir("o", "w1");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/m/miradas-abc/o/w1");
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(db.$executeRaw.mock.calls[0]!.slice(1)).toEqual(["a1", "w1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), "SCAN"]);
  });
  it("el cartel lleva a la muestra y el afiche al libro", async () => {
    expect((await pedir("m", "a1")).headers.get("location")).toBe("/m/miradas-abc");
    const libro = await pedir("l", "a1");
    expect(libro.headers.get("location")).toBe("/m/miradas-abc/libro");
    expect(db.$executeRaw.mock.calls[1]!.slice(1)).toEqual(["a1", "", expect.any(String), "GUESTBOOK_SCAN"]);
  });
  it("un robot o el organizador no cuentan, pero igual redirige", async () => {
    expect((await pedir("o", "w1", "facebookexternalhit/1.1")).status).toBe(302);
    // Integrante del equipo (o dueño): `esDelEquipo` lo encuentra.
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    db.culturalActivity.count.mockResolvedValue(1);
    expect((await pedir("o", "w1")).status).toBe(302);
    expect(db.culturalActivity.count.mock.calls[0]![0].where).toMatchObject({ AND: [{ id: "a1" }, expect.anything()] });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("un código de sala cuenta un escaneo, da el pase y lleva a la vista de sala", async () => {
    const r = await pedir("s", "abcdefghjkmn");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/m/miradas-abc/sala/o/w1");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^mf_sala_a1=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}; /);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=28800");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const valor = cookie.split(";")[0]!.slice("mf_sala_a1=".length);
    expect(leerPase(valor, LLAVE)).toMatchObject({ a: "a1", w: ["w1"] });
    // La llave no sale nunca: ni en la cookie ni en la dirección.
    expect(cookie).not.toContain(LLAVE);
    expect(db.$executeRaw.mock.calls[0]!.slice(1)).toEqual(["a1", "w1", expect.any(String), "SCAN"]);
    expect(db.culturalActivity.findUnique).not.toHaveBeenCalled();
  });
  it("por https la cookie es Secure", async () => {
    const r = await pedir("s", "abcdefghjkmn", UA, {}, "https://muestrasfotograficas.com");
    expect(r.headers.get("set-cookie")).toContain("; Secure");
  });
  it("con un pase previo válido, el nuevo lleva las dos obras", async () => {
    const previo = firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w: ["w1"] }, LLAVE);
    const r = await pedir("s", "nmkjhgfedcba", UA, { cookie: `otra=1; mf_sala_a1=${previo}` });
    const valor = r.headers.get("set-cookie")!.split(";")[0]!.slice("mf_sala_a1=".length);
    expect(leerPase(valor, LLAVE)?.w).toEqual(["w1", "w2"]);
  });
  it("un pase previo con otra firma, vencido o de otra muestra no se suma", async () => {
    for (const previo of [
      firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w: ["w-oculta"] }, "d".repeat(64)),
      firmarPase({ v: 1, a: "a1", exp: Date.now() - 1, w: ["w-oculta"] }, LLAVE),
      firmarPase({ v: 1, a: "otra", exp: Date.now() + 3600_000, w: ["w-oculta"] }, LLAVE),
    ]) {
      const r = await pedir("s", "nmkjhgfedcba", UA, { cookie: `mf_sala_a1=${previo}` });
      const valor = r.headers.get("set-cookie")!.split(";")[0]!.slice("mf_sala_a1=".length);
      expect(leerPase(valor, LLAVE)?.w).toEqual(["w2"]);
    }
  });
  it("un código inexistente o mal formado va a la portada sin cookie ni conteo", async () => {
    for (const code of ["zzzzzzzzzzzz", "corto", "w1"]) {
      const r = await pedir("s", code);
      expect(r.headers.get("location")).toBe("/");
      expect(r.headers.get("set-cookie")).toBeNull();
    }
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("la ficha vieja /q/o/<obra> no da pase", async () => {
    const r = await pedir("o", "w1");
    expect(r.headers.get("location")).toBe("/m/miradas-abc/o/w1");
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("muestra despublicada u obra que ya no está: a la portada sin pase", async () => {
    db.culturalActivityRoomCode.findUnique.mockResolvedValueOnce({ workId: "w1", activity: { ...muestra, reviewStatus: "UNPUBLISHED" } });
    expect((await pedir("s", "abcdefghjkmn")).headers.get("location")).toBe("/");
    db.culturalActivityWork.findFirst.mockResolvedValueOnce(null);
    const r = await pedir("s", "abcdefghjkmn");
    expect(r.headers.get("location")).toBe("/");
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("HEAD de un código de sala no da pase ni cuenta", async () => {
    const r = await HEAD(new Request("http://localhost:3014/q/s/abcdefghjkmn", { method: "HEAD", headers: { "user-agent": UA } }), { params: Promise.resolve({ tipo: "s", id: "abcdefghjkmn" }) });
    expect(r.headers.get("location")).toBe("/m/miradas-abc/sala/o/w1");
    expect(r.headers.get("set-cookie")).toBeNull();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("algo despublicado, inexistente o mal formado va a la portada sin contar", async () => {
    db.culturalActivityWork.findUnique.mockResolvedValue({ id: "w1", activity: { ...muestra, reviewStatus: "UNPUBLISHED" } });
    expect((await pedir("o", "w1")).headers.get("location")).toBe("/");
    db.culturalActivity.findUnique.mockResolvedValue(null);
    expect((await pedir("m", "nada")).headers.get("location")).toBe("/");
    expect((await pedir("x", "a1")).headers.get("location")).toBe("/");
    expect((await pedir("o", "../../etc")).headers.get("location")).toBe("/");
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("si contar falla, la redirección anda igual", async () => {
    db.$executeRaw.mockRejectedValue(new Error("base caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await pedir("o", "w1")).status).toBe(302);
    error.mockRestore();
  });
  it("la dirección de destino es relativa (no depende del host interno)", async () => {
    expect((await pedir("o", "w1")).headers.get("location")).toBe("/m/miradas-abc/o/w1");
  });
  it("una charla publicada no es una muestra: va a la portada sin contar", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, type: "CHARLA" });
    expect((await pedir("m", "a1")).headers.get("location")).toBe("/");
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it("HEAD de algo despublicado va a la portada", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, reviewStatus: "UNPUBLISHED" });
    const r = await HEAD(new Request("http://localhost:3014/q/m/a1", { method: "HEAD", headers: { "user-agent": UA } }), { params: Promise.resolve({ tipo: "m", id: "a1" }) });
    expect(r.headers.get("location")).toBe("/");
  });
  it("la misma obra desde la misma IP cuenta hasta 30 veces cada 10 minutos", async () => {
    for (let i = 0; i < 35; i++) await pedir("o", "w1");
    expect(db.$executeRaw).toHaveBeenCalledTimes(LIMITES_PUBLICOS.escaneosPorPagina.limit);
  });
  it("pasado el freno barato, va a la portada sin consultar la base", async () => {
    for (let i = 0; i < LIMITES_PUBLICOS.qr.limit; i++) await pedir("x", "a1");
    vi.clearAllMocks();
    expect((await pedir("o", "w1")).headers.get("location")).toBe("/");
    expect(db.culturalActivityWork.findUnique).not.toHaveBeenCalled();
  });
  it("HEAD redirige sin contar", async () => {
    const r = await HEAD(new Request("http://localhost:3014/q/o/w1", { method: "HEAD", headers: { "user-agent": UA } }), { params: Promise.resolve({ tipo: "o", id: "w1" }) });
    expect(r.status).toBe(302);
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
