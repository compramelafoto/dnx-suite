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

  it("sin fila de conexión la crea SIMULADA", async () => {
    await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "hola" }, AHORA);
    expect(B.datos.fotofficeWaConexion).toHaveLength(1);
    expect(B.datos.fotofficeWaConexion[0]).toMatchObject({ workspaceId: "w1", modo: "SIMULADO" });
  });

  it("con una fila existente no la pisa y usa su pausa del bot", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", phoneNumberId: null, modo: "SIMULADO", pausaBotHoras: 9 });
    await simularEntrante(ADMIN, { telefono: "341 341-9869", texto: "hola" }, AHORA);
    expect(B.datos.fotofficeWaConexion).toHaveLength(1);
    expect(B.datos.fotofficeWaConexion[0]).toMatchObject({ pausaBotHoras: 9 });
    // La pausa se aplica con un eco desde el celular: dura 9 horas, no las 4 por omisión.
    const { aplicarEventos } = await import("./registro");
    await aplicarEventos([{ tipo: "ECO", phoneNumberId: "simulado", waMessageId: "e1", waId: "5493413419869", en: AHORA, mensajeTipo: "TEXTO", texto: "x", media: null }], AHORA, { workspaceId: "w1" });
    const pausa = (B.datos.fotofficeWaChat[0].botPausadoHasta as Date).getTime();
    expect(pausa).toBe(AHORA.getTime() + 9 * 3600_000);
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
