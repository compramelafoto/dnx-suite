import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $executeRaw: vi.fn() }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
const { esDeQuienOrganiza, pedidoContable, sumarUno } = await import("./contar");

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1";
beforeEach(() => vi.clearAllMocks());

describe("sumarUno", () => {
  it("suma uno con INSERT … ON CONFLICT y el día argentino como texto", async () => {
    // 01:00 UTC del 16 = 22:00 del 15 en Argentina.
    await sumarUno({ activityId: "a1", workId: "", metric: "VIEW", ahora: new Date("2026-11-16T01:00:00Z") });
    const [sql, ...valores] = db.$executeRaw.mock.calls[0]!;
    expect((sql as string[]).join("?")).toMatch(/ON CONFLICT \("activityId", "workId", "day", "metric"\) DO UPDATE SET "count" = "CulturalActivityDailyStat"\."count" \+ 1/);
    expect(valores).toEqual(["a1", "", "2026-11-15", "VIEW"]);
  });
});

describe("qué se cuenta", () => {
  it("un navegador sí; un robot o una precarga no", () => {
    expect(pedidoContable(new Headers({ "user-agent": UA }))).toBe(true);
    expect(pedidoContable(new Headers({ "user-agent": "WhatsApp/2.24" }))).toBe(false);
    expect(pedidoContable(new Headers({ "user-agent": UA, "sec-purpose": "prefetch" }))).toBe(false);
  });
  it("no cuenta al organizador ni al super admin", async () => {
    usuarioActual.valor = null;
    expect(await esDeQuienOrganiza(7)).toBe(false);
    usuarioActual.valor = { id: 7, esSuperAdmin: false };
    expect(await esDeQuienOrganiza(7)).toBe(true);
    usuarioActual.valor = { id: 8, esSuperAdmin: false };
    expect(await esDeQuienOrganiza(7)).toBe(false);
    usuarioActual.valor = { id: 1, esSuperAdmin: true };
    expect(await esDeQuienOrganiza(7)).toBe(true);
  });
});
