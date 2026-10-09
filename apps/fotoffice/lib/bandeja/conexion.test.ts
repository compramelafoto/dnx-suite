import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ hayToken: vi.fn(), guardarToken: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ hayTokenWhatsapp: H.hayToken, guardarTokenWhatsapp: H.guardarToken }));

const { leerConexion, guardarConexion, estadoConexion } = await import("./conexion");

const ADMIN = { workspaceId: "w1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: {} } as never };
const EQUIPO = { workspaceId: "w1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { "whatsapp-inbox": "MANAGE" } } as never };

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  H.guardarToken.mockReset();
  H.hayToken.mockResolvedValue(false);
});

describe("leerConexion", () => {
  it("sin fila: simulada y con 4 horas de pausa", async () => {
    expect(await leerConexion("w1")).toMatchObject({ workspaceId: "w1", modo: "SIMULADO", pausaBotHoras: 4, phoneNumberId: null });
  });
});

describe("estadoConexion", () => {
  it("modo, si hay token y número; nunca el token", async () => {
    H.hayToken.mockResolvedValue(true);
    await guardarConexion(ADMIN, { phoneNumberId: "123456" });
    expect(await estadoConexion("w1")).toEqual({ modo: "SIMULADO", tieneToken: true, phoneNumberId: "123456" });
  });
});

describe("guardarConexion", () => {
  it("si el número choca, no se guarda el token", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w2", phoneNumberId: "123456" });
    expect(await guardarConexion(ADMIN, { phoneNumberId: "123456", token: "EAAG" })).toMatchObject({ ok: false });
    expect(H.guardarToken).not.toHaveBeenCalled();
  });

  it("si falla el token al pasar a REAL, vuelve al modo anterior", async () => {
    H.guardarToken.mockRejectedValue(new Error("sin clave"));
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", token: "EAAG" })).toMatchObject({ ok: false });
    expect(await leerConexion("w1")).toMatchObject({ modo: "SIMULADO" });
  });

  it("sólo configura quien puede `configurar`", async () => {
    expect(await guardarConexion(EQUIPO, { pausaBotHoras: 6 })).toMatchObject({ ok: false });
    expect(B.datos.fotofficeWaConexion).toHaveLength(0);
  });

  it("crea la fila con el número y la pausa; el token va al baúl, no a la tabla", async () => {
    const r = await guardarConexion(ADMIN, { phoneNumberId: " 106540352242922 ", pausaBotHoras: 6, token: "EAAG-x" });
    expect(r).toEqual({ ok: true });
    expect(H.guardarToken).toHaveBeenCalledWith("w1", "EAAG-x", 1);
    expect(B.datos.fotofficeWaConexion[0]).toMatchObject({ workspaceId: "w1", phoneNumberId: "106540352242922", pausaBotHoras: 6, modo: "SIMULADO" });
    expect(JSON.stringify(B.datos.fotofficeWaConexion)).not.toContain("EAAG-x");
    expect(await leerConexion("w1")).toMatchObject({ phoneNumberId: "106540352242922", pausaBotHoras: 6 });
  });

  it("valida el identificador (sólo dígitos) y la pausa (1 a 72)", async () => {
    expect(await guardarConexion(ADMIN, { phoneNumberId: "12ab" })).toMatchObject({ ok: false });
    expect(await guardarConexion(ADMIN, { pausaBotHoras: 0 })).toMatchObject({ ok: false });
    expect(await guardarConexion(ADMIN, { pausaBotHoras: 73 })).toMatchObject({ ok: false });
    expect(await guardarConexion(ADMIN, { pausaBotHoras: 1.5 })).toMatchObject({ ok: false });
    expect(await guardarConexion(ADMIN, { pausaBotHoras: "4" })).toMatchObject({ ok: false });
    expect(await guardarConexion(ADMIN, { modo: "OTRO" })).toMatchObject({ ok: false });
    expect(B.datos.fotofficeWaConexion).toHaveLength(0);
  });

  it("pasar a REAL exige número y token", async () => {
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" })).toMatchObject({ ok: false });
    H.hayToken.mockResolvedValue(true);
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" })).toEqual({ ok: true });
    expect(await leerConexion("w1")).toMatchObject({ modo: "REAL" });
  });

  it("editar sin token conserva el que había y lo ya guardado", async () => {
    await guardarConexion(ADMIN, { phoneNumberId: "123456", pausaBotHoras: 8 });
    await guardarConexion(ADMIN, { pausaBotHoras: 2 });
    expect(await leerConexion("w1")).toMatchObject({ phoneNumberId: "123456", pausaBotHoras: 2 });
    expect(H.guardarToken).not.toHaveBeenCalled();
  });

  it("el mismo número en otra institución choca con un mensaje claro", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w2", phoneNumberId: "123456" });
    expect(await guardarConexion(ADMIN, { phoneNumberId: "123456" })).toMatchObject({ ok: false, error: expect.stringContaining("otra institución") });
  });
});
