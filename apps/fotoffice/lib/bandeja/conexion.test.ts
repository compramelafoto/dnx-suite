import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ hayToken: vi.fn(), guardarToken: vi.fn(), leerToken: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ hayTokenWhatsapp: H.hayToken, guardarTokenWhatsapp: H.guardarToken, leerTokenWhatsapp: H.leerToken }));

const { leerConexion, guardarConexion, estadoConexion } = await import("./conexion");

const ADMIN = { workspaceId: "w1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: {} } as never };
const EQUIPO = { workspaceId: "w1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { "whatsapp-inbox": "MANAGE" } } as never };

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  H.guardarToken.mockReset();
  H.hayToken.mockResolvedValue(false);
  H.leerToken.mockResolvedValue(null);
});

const metaOk = (id: string, display = "+54 9 341 555-1234") =>
  vi.fn(async () => new Response(JSON.stringify({ id, display_phone_number: display }), { status: 200 })) as unknown as typeof fetch;

describe("leerConexion", () => {
  it("sin fila: simulada y con 4 horas de pausa", async () => {
    expect(await leerConexion("w1")).toMatchObject({ workspaceId: "w1", modo: "SIMULADO", pausaBotHoras: 4, phoneNumberId: null });
  });
});

describe("estadoConexion", () => {
  it("modo, si hay token y número; nunca el token", async () => {
    H.hayToken.mockResolvedValue(true);
    await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, { fetch: metaOk("123456"), leerToken: async () => "EAAG" });
    expect(await estadoConexion("w1")).toEqual({ modo: "REAL", tieneToken: true, phoneNumberId: "123456" });
  });
});

describe("guardarConexion", () => {
  it("si el número choca, no se guarda el token", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w2", phoneNumberId: "123456", modo: "REAL" });
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", token: "EAAG" }, { fetch: metaOk("123456") })).toMatchObject({ ok: false });
    expect(H.guardarToken).not.toHaveBeenCalled();
  });

  it("si falla el token al pasar a REAL, vuelve al modo anterior", async () => {
    H.guardarToken.mockRejectedValue(new Error("sin clave"));
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", token: "EAAG" }, { fetch: metaOk("123456") })).toMatchObject({ ok: false });
    expect(await leerConexion("w1")).toMatchObject({ modo: "SIMULADO", phoneNumberId: null });
  });

  it("sólo configura quien puede `configurar`", async () => {
    expect(await guardarConexion(EQUIPO, { pausaBotHoras: 6 })).toMatchObject({ ok: false });
    expect(B.datos.fotofficeWaConexion).toHaveLength(0);
  });

  it("crea la fila con el número y la pausa; el token va al baúl, no a la tabla", async () => {
    const r = await guardarConexion(ADMIN, { phoneNumberId: " 106540352242922 ", pausaBotHoras: 6, token: "EAAG-x" });
    expect(r).toEqual({ ok: true });
    expect(H.guardarToken).toHaveBeenCalledWith("w1", "EAAG-x", 1);
    expect(B.datos.fotofficeWaConexion[0]).toMatchObject({ workspaceId: "w1", pausaBotHoras: 6, modo: "SIMULADO" });
    expect(JSON.stringify(B.datos.fotofficeWaConexion)).not.toContain("EAAG-x");
    expect(await leerConexion("w1")).toMatchObject({ pausaBotHoras: 6 });
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
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, { fetch: metaOk("123456"), leerToken: async () => "EAAG" })).toEqual({ ok: true });
    expect(await leerConexion("w1")).toMatchObject({ modo: "REAL" });
  });

  it("editar sin token conserva el que había y lo ya guardado", async () => {
    H.hayToken.mockResolvedValue(true);
    const deps = { fetch: metaOk("123456"), leerToken: async () => "EAAG" };
    await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", pausaBotHoras: 8 }, deps);
    await guardarConexion(ADMIN, { pausaBotHoras: 2 }, deps);
    expect(await leerConexion("w1")).toMatchObject({ phoneNumberId: "123456", pausaBotHoras: 2 });
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    expect(H.guardarToken).not.toHaveBeenCalled();
  });

  it("el mismo número en otra institución choca con un mensaje claro", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w2", phoneNumberId: "123456", modo: "REAL" });
    H.hayToken.mockResolvedValue(true);
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, { fetch: metaOk("123456"), leerToken: async () => "EAAG" })).toMatchObject({
      ok: false, error: expect.stringContaining("otra institución"),
    });
  });

  describe("verificación con Meta", () => {
    const MSG = "No pudimos verificar ese número con Meta: revisá el Phone number ID y el token.";
    beforeEach(() => H.hayToken.mockResolvedValue(true));

    it("al pasar a REAL consulta a Meta con el token de la institución y completa el número para mostrar", async () => {
      const f = metaOk("123456");
      expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", token: "EAAG-x" }, { fetch: f })).toEqual({ ok: true });
      const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, { headers: Record<string, string> }];
      expect(url).toBe("https://graph.facebook.com/v21.0/123456?fields=id,display_phone_number");
      expect(init.headers.Authorization).toBe("Bearer EAAG-x");
      expect(await leerConexion("w1")).toMatchObject({ modo: "REAL", phoneNumberId: "123456", displayPhone: "+54 9 341 555-1234" });
    });

    it("sin token nuevo usa el del baúl", async () => {
      const f = metaOk("123456");
      await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, { fetch: f, leerToken: async () => "EAAG-baul" });
      expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].headers.Authorization).toBe("Bearer EAAG-baul");
    });

    it("si Meta no responde 200 o el id no coincide, rechaza y conserva el modo anterior", async () => {
      const deps = (f: typeof fetch) => ({ fetch: f, leerToken: async () => "EAAG" });
      const mal = vi.fn(async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
      expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, deps(mal))).toEqual({ ok: false, error: MSG });
      expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, deps(metaOk("999999")))).toEqual({ ok: false, error: MSG });
      const cae = vi.fn(async () => { throw new Error("red"); }) as unknown as typeof fetch;
      expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, deps(cae))).toEqual({ ok: false, error: MSG });
      expect(B.datos.fotofficeWaConexion).toHaveLength(0);
    });

    it("estando en REAL, cambiar de número vuelve a verificar y el rechazo deja el anterior", async () => {
      await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456" }, { fetch: metaOk("123456"), leerToken: async () => "EAAG" });
      const r = await guardarConexion(ADMIN, { phoneNumberId: "777777" }, { fetch: metaOk("000"), leerToken: async () => "EAAG" });
      expect(r).toEqual({ ok: false, error: MSG });
      expect(await leerConexion("w1")).toMatchObject({ modo: "REAL", phoneNumberId: "123456" });
    });

    it("en SIMULADO no consulta a Meta y no guarda el número (no reserva el único)", async () => {
      const f = metaOk("123456");
      expect(await guardarConexion(ADMIN, { phoneNumberId: "123456" }, { fetch: f })).toEqual({ ok: true });
      expect(f).not.toHaveBeenCalled();
      expect(B.datos.fotofficeWaConexion[0].phoneNumberId).toBeNull();
    });
  });
});
