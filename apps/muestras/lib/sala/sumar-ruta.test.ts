import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn() },
  culturalActivityRoomKey: { findUnique: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));
const { GET } = await import("@/app/m/[slug]/sala/sumar/[workId]/route");
const { resetRateLimit } = await import("@/lib/limite");
const { firmarEscaneo, firmarPase, leerPase } = await import("./llave");
const { ROOM_PASS_MAX_WORKS } = await import("@repo/muestras");

const LLAVE = "c".repeat(64);
const muestra = { id: "a1", type: "MUESTRA", reviewStatus: "APPROVED" };
function pedir(workId: string, o: { ts?: number; firma?: string; cookie?: string; origen?: string; slug?: string } = {}) {
  const ts = o.ts ?? Date.now();
  const firma = o.firma ?? firmarEscaneo("a1", workId, ts, LLAVE);
  const slug = o.slug ?? "miradas-abc";
  const headers: Record<string, string> = { "x-forwarded-for": "1.1.1.1" };
  if (o.cookie) headers.cookie = o.cookie;
  return GET(new Request(`${o.origen ?? "http://localhost:3014"}/m/${slug}/sala/sumar/${workId}?t=${ts}&f=${firma}`, { headers }), {
    params: Promise.resolve({ slug, workId }),
  });
}
const valor = (r: Response) => r.headers.get("set-cookie")!.split(";")[0]!.slice("mf_sala_a1=".length);

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
  db.culturalActivityRoomKey.findUnique.mockResolvedValue({ secret: LLAVE });
});

describe("GET /m/[slug]/sala/sumar/[workId]", () => {
  it("con el escaneo firmado da el pase, con Path de la sala, y lleva a la vista de sala", async () => {
    const r = await pedir("w1");
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("/m/miradas-abc/sala/o/w1");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const cookie = r.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^mf_sala_a1=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}; /);
    expect(cookie).toContain("; Path=/m/miradas-abc/sala;");
    expect(cookie).not.toContain("Path=/;");
    expect(cookie).toContain("Max-Age=28800");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
    expect(leerPase(valor(r), LLAVE)).toMatchObject({ a: "a1", w: ["w1"] });
    expect(cookie).not.toContain(LLAVE);
  });

  it("por https la cookie es Secure", async () => {
    expect((await pedir("w1", { origen: "https://muestrasfotograficas.com" })).headers.get("set-cookie")).toContain("; Secure");
  });

  it("con un pase previo válido, el nuevo lleva las dos obras", async () => {
    const previo = firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w: ["w1"] }, LLAVE);
    expect(leerPase(valor(await pedir("w2", { cookie: `otra=1; mf_sala_a1=${previo}` })), LLAVE)?.w).toEqual(["w1", "w2"]);
  });

  it("un pase previo con otra firma, vencido o de otra muestra no se suma", async () => {
    for (const previo of [
      firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w: ["w-oculta"] }, "d".repeat(64)),
      firmarPase({ v: 1, a: "a1", exp: Date.now() - 1, w: ["w-oculta"] }, LLAVE),
      firmarPase({ v: 1, a: "otra", exp: Date.now() + 3600_000, w: ["w-oculta"] }, LLAVE),
    ]) {
      expect(leerPase(valor(await pedir("w2", { cookie: `mf_sala_a1=${previo}` })), LLAVE)?.w).toEqual(["w2"]);
    }
  });

  it("el pase guarda a lo sumo 30 obras", async () => {
    const w = Array.from({ length: ROOM_PASS_MAX_WORKS }, (_, i) => `w${i}`);
    const previo = firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w }, LLAVE);
    const p = leerPase(valor(await pedir("nueva", { cookie: `mf_sala_a1=${previo}` })), LLAVE)!;
    expect(p.w).toHaveLength(30);
    expect(p.w.at(-1)).toBe("nueva");
  });

  it("sin firma válida (de otra obra, otra llave, vieja o rota) no da pase, pero lleva a la sala", async () => {
    const viejo = Date.now() - 3 * 60_000;
    for (const o of [
      { firma: firmarEscaneo("a1", "otra", Date.now(), LLAVE) },
      { firma: firmarEscaneo("a1", "w1", Date.now(), "d".repeat(64)) },
      { ts: viejo, firma: firmarEscaneo("a1", "w1", viejo, LLAVE) },
      { firma: "nada" },
    ]) {
      const r = await pedir("w1", o);
      expect(r.headers.get("location")).toBe("/m/miradas-abc/sala/o/w1");
      expect(r.headers.get("set-cookie")).toBeNull();
    }
  });

  it("muestra sin publicar o sin llave: sin pase", async () => {
    db.culturalActivity.findUnique.mockResolvedValueOnce({ ...muestra, reviewStatus: "UNPUBLISHED" });
    expect((await pedir("w1")).headers.get("set-cookie")).toBeNull();
    db.culturalActivityRoomKey.findUnique.mockResolvedValueOnce(null);
    expect((await pedir("w1")).headers.get("set-cookie")).toBeNull();
  });

  it("slug u obra con forma rara: a la portada sin consultar", async () => {
    expect((await pedir("w1", { slug: "A B" })).headers.get("location")).toBe("/");
    expect(db.culturalActivity.findUnique).not.toHaveBeenCalled();
  });
});
