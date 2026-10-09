import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ hayTokenWhatsapp: vi.fn(async () => false), guardarTokenWhatsapp: vi.fn() }));

const { simularEntrante } = await import("./simulador");

const ADMIN = { workspaceId: "w1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: {} } as never };
const EQUIPO = { workspaceId: "w1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { "whatsapp-inbox": "MANAGE" } } as never };
const AHORA = new Date("2026-10-09T15:00:00.000Z");

beforeEach(() => B.vaciar());

describe("simularEntrante", () => {
  it("crea chat y mensaje por el mismo registro: BOT, un no leído, cliente vinculado por teléfono", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", phone: "+54 9 341 341-9869" });
    const r = await simularEntrante(ADMIN, { telefono: "341 341-9869", nombre: "Lucía", texto: "Hola, quiero un presupuesto" }, AHORA);
    expect(r.ok).toBe(true);
    expect(B.datos.fotofficeWaChat).toHaveLength(1);
    expect(B.datos.fotofficeWaChat[0]).toMatchObject({ workspaceId: "w1", waId: "5493413419869", estado: "BOT", noLeidos: 1, clientId: "c1", nombre: "Lucía" });
    expect(B.datos.fotofficeWaMensaje[0]).toMatchObject({ direccion: "ENTRANTE", autor: "CLIENTE", texto: "Hola, quiero un presupuesto" });
    expect(String(B.datos.fotofficeWaMensaje[0].waMessageId)).toMatch(/^sim-/);
    if (r.ok) expect(r.chatId).toBe(B.datos.fotofficeWaChat[0].id);
  });

  it("sin fila de conexión la crea simulada; con una existente usa su pausa", async () => {
    await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "hola" }, AHORA);
    expect(B.datos.fotofficeWaConexion).toHaveLength(1);
  });

  it("dos simulaciones seguidas suman no leídos (ids distintos)", async () => {
    await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "uno" }, AHORA);
    await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "dos" }, AHORA);
    expect(B.datos.fotofficeWaChat[0]).toMatchObject({ noLeidos: 2 });
  });

  it("se rechaza en modo REAL", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", phoneNumberId: "123456", modo: "REAL" });
    expect(await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "hola" }, AHORA)).toMatchObject({ ok: false });
    expect(B.datos.fotofficeWaChat).toHaveLength(0);
  });

  it("sólo con `configurar`", async () => {
    expect(await simularEntrante(EQUIPO, { telefono: "341 341-9869", texto: "hola" }, AHORA)).toMatchObject({ ok: false });
    expect(await simularEntrante({ ...ADMIN, userId: null }, { telefono: "341 341-9869", texto: "hola" }, AHORA)).toMatchObject({ ok: false });
    expect(B.datos.fotofficeWaChat).toHaveLength(0);
  });

  it("valida teléfono y texto", async () => {
    expect(await simularEntrante(ADMIN, { telefono: "abc", texto: "hola" }, AHORA)).toMatchObject({ ok: false });
    expect(await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "   " }, AHORA)).toMatchObject({ ok: false });
    expect(await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "x".repeat(4097) }, AHORA)).toMatchObject({ ok: false });
    expect(B.datos.fotofficeWaChat).toHaveLength(0);
  });
});
