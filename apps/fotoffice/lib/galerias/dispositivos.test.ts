import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ filas: [] as Record<string, unknown>[], seq: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/access/policy", () => ({ puedeEnContexto: (ctx: { configurar?: boolean }) => ctx.configurar === true }));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeDispositivo: {
      count: async ({ where }: { where: Record<string, unknown> }) => H.filas.filter((f) => f.workspaceId === where.workspaceId && (where.revokedAt === null ? f.revokedAt === null : true) && (where.id ? f.id === where.id : true)).length,
      create: async ({ data }: { data: Record<string, unknown> }) => { const f = { id: `d${++H.seq}`, createdAt: new Date(), lastUsedAt: null, revokedAt: null, ...data }; H.filas.push(f); return f; },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const m = H.filas.filter((f) => f.id === where.id && f.workspaceId === where.workspaceId && f.revokedAt === null);
        m.forEach((f) => Object.assign(f, data));
        return { count: m.length };
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) => H.filas.filter((f) => f.workspaceId === where.workspaceId),
    },
  },
}));

import { anularDispositivo, crearDispositivo, generarClaveDispositivo, hashDeClave, listarDispositivos, MAX_DISPOSITIVOS_ACTIVOS } from "./dispositivos";

const ctx = (workspaceId = "ws1", configurar = true) => ({ workspaceId, userId: 7, configurar }) as never;
beforeEach(() => { H.filas = []; });

describe("dispositivos", () => {
  it("la clave tiene el formato fo_dev_ + 43 caracteres y el hash es SHA-256 hex", () => {
    const k = generarClaveDispositivo();
    expect(k.clave).toMatch(/^fo_dev_[A-Za-z0-9_-]{43}$/);
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(k.hash).toBe(hashDeClave(k.clave));
    expect(k.clave.startsWith(`fo_dev_${k.prefijo}`)).toBe(true);
    expect(k.prefijo).toHaveLength(8);
    expect(generarClaveDispositivo().clave).not.toBe(k.clave);
  });
  it("crear guarda sólo el hash y el prefijo; la clave completa vuelve una vez", async () => {
    const r = await crearDispositivo(ctx(), "  Mac   del estudio ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(H.filas[0]).toMatchObject({ name: "Mac del estudio", keyPrefix: r.prefijo, keyHash: hashDeClave(r.clave), createdByUserId: 7 });
    expect(JSON.stringify(H.filas)).not.toContain(r.clave);
    const lista = await listarDispositivos(ctx());
    expect(JSON.stringify(lista)).not.toContain(r.clave);
    expect(lista[0]).toMatchObject({ nombre: "Mac del estudio", prefijo: r.prefijo, anulado: false });
  });
  it("sin permiso de configurar no crea, no anula ni lista", async () => {
    expect(await crearDispositivo(ctx("ws1", false), "x")).toMatchObject({ ok: false });
    expect(await listarDispositivos(ctx("ws1", false))).toEqual([]);
    expect(H.filas).toHaveLength(0);
  });
  it("nombre vacío o de más de 60 caracteres", async () => {
    expect((await crearDispositivo(ctx(), "   ")).ok).toBe(false);
    expect((await crearDispositivo(ctx(), "x".repeat(61))).ok).toBe(false);
    expect((await crearDispositivo(ctx(), "x".repeat(60))).ok).toBe(true);
  });
  it("tope de 10 activos; anular libera un lugar", async () => {
    for (let i = 0; i < MAX_DISPOSITIVOS_ACTIVOS; i++) expect((await crearDispositivo(ctx(), `d${i}`)).ok).toBe(true);
    expect((await crearDispositivo(ctx(), "uno más")).ok).toBe(false);
    expect((await crearDispositivo(ctx("ws2"), "otro workspace")).ok).toBe(true);
    expect(await anularDispositivo(ctx(), H.filas[0].id)).toEqual({ ok: true });
    expect(H.filas[0].revokedAt).toBeInstanceOf(Date);
    expect((await crearDispositivo(ctx(), "ahora sí")).ok).toBe(true);
  });
  it("anular: ya anulado, inexistente y de otro workspace", async () => {
    await crearDispositivo(ctx(), "a");
    const id = H.filas[0].id;
    expect(await anularDispositivo(ctx("ws2"), id)).toMatchObject({ ok: false });
    expect(H.filas[0].revokedAt).toBeNull();
    expect(await anularDispositivo(ctx(), id)).toEqual({ ok: true });
    expect(await anularDispositivo(ctx(), id)).toMatchObject({ ok: false });
    expect(await anularDispositivo(ctx(), "nada")).toMatchObject({ ok: false });
  });
});
