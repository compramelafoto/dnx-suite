import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ hayToken: vi.fn(), guardarToken: vi.fn(), leerToken: vi.fn(), igGuardar: vi.fn(), igBorrar: vi.fn(), igHay: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ hayTokenWhatsapp: H.hayToken, guardarTokenWhatsapp: H.guardarToken, leerTokenWhatsapp: H.leerToken }));

vi.mock("@/lib/integrations/instagram/credentials", () => ({ guardarTokenInstagram: H.igGuardar, borrarTokenInstagram: H.igBorrar, hayTokenInstagram: H.igHay }));

const { leerConexion, guardarConexion, estadoConexion, conectarInstagram, desconectarInstagram, estadoInstagram } = await import("./conexion");

const ADMIN = { workspaceId: "w1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: {} } as never };
const EQUIPO = { workspaceId: "w1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { "whatsapp-inbox": "MANAGE" } } as never };

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  H.guardarToken.mockReset();
  H.hayToken.mockResolvedValue(false);
  H.leerToken.mockResolvedValue(null);
  H.igGuardar.mockReset();
  H.igBorrar.mockReset();
  H.igHay.mockResolvedValue(false);
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

describe("suscripción de la cuenta de WhatsApp a la app (sin esto Meta no manda los mensajes)", () => {
  /** Responde la verificación del número (GET) y la suscripción (POST) por separado. */
  const metaCon = (suscripcion: number) =>
    vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ success: suscripcion === 200 }), { status: suscripcion })
        : new Response(JSON.stringify({ id: "123456", display_phone_number: "+1 555-198-4447" }), { status: 200 }),
    ) as unknown as typeof fetch;
  const posts = (f: typeof fetch) => (f as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls.filter(([, i]) => i?.method === "POST");

  it("al guardar en real con la cuenta, la suscribe a la app con el token", async () => {
    const f = metaCon(200);
    expect(await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", wabaId: "987654", token: "EAAG" }, { fetch: f })).toEqual({ ok: true });
    const [[url, init]] = posts(f);
    expect(url).toMatch(/\/987654\/subscribed_apps$/);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer EAAG");
  });

  it("si Meta no acepta la suscripción, no queda en real y lo dice", async () => {
    const r = await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", wabaId: "987654", token: "EAAG" }, { fetch: metaCon(400) });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/WhatsApp Business Account ID/) });
    expect((await leerConexion("w1")).modo).toBe("SIMULADO");
  });

  it("volver a guardar estando en real también suscribe (así se arregla una conexión ya hecha)", async () => {
    H.hayToken.mockResolvedValue(true);
    await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", token: "EAAG" }, { fetch: metaCon(200) });
    const f = metaCon(200);
    expect(await guardarConexion(ADMIN, { wabaId: "987654" }, { fetch: f, leerToken: async () => "EAAG-baul" })).toEqual({ ok: true });
    expect(posts(f)).toHaveLength(1);
  });

  it("sin cuenta de WhatsApp cargada, no intenta suscribir", async () => {
    const f = metaCon(200);
    await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", token: "EAAG" }, { fetch: f });
    expect(posts(f)).toHaveLength(0);
  });
});

describe("si Meta rechaza la suscripción, se ve su motivo", () => {
  it("el error incluye el mensaje y el código de Meta (nunca el token)", async () => {
    const f = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ error: { message: "Unsupported post request. Object with ID '987654' does not exist", code: 100, error_subcode: 33 } }), { status: 400 })
        : new Response(JSON.stringify({ id: "123456", display_phone_number: "+1 555" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const r = await guardarConexion(ADMIN, { modo: "REAL", phoneNumberId: "123456", wabaId: "987654", token: "EAAG-secreto" }, { fetch: f });
    expect(r).toMatchObject({ ok: false });
    const error = (r as { error: string }).error;
    expect(error).toContain("does not exist");
    expect(error).toContain("100");
    expect(error).not.toContain("EAAG-secreto");
  });
});

describe("conectarInstagram", () => {
  type Llamada = [string, RequestInit?];
  /** Meta falso: `/me/accounts` devuelve `paginas`; la suscripción responde `suscripcion`. */
  const metaIg = (paginas: unknown[], suscripcion: Response = new Response(JSON.stringify({ success: true }), { status: 200 })) =>
    vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === "POST" ? suscripcion : new Response(JSON.stringify({ data: paginas }), { status: 200 }),
    ) as unknown as typeof fetch;
  const llamadas = (f: typeof fetch) => (f as unknown as { mock: { calls: Llamada[] } }).mock.calls;
  const PAGINA = { id: "111", name: "DNX Estudio", access_token: "EAAP-pagina", instagram_business_account: { id: "1784", username: "dnxestudio" } };

  it("con fetch falso guarda página, cuenta y usuario, suscribe la página y guarda el token de página (no el del sistema)", async () => {
    const f = metaIg([{ id: "999", name: "Sin IG", access_token: "EAAP-otra" }, PAGINA]);
    expect(await conectarInstagram(ADMIN, { token: " EAAG-sistema " }, { fetch: f })).toEqual({ ok: true });
    const [[urlGet, initGet], [urlPost, initPost]] = llamadas(f);
    expect(urlGet).toBe("https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account%7Bid,username%7D");
    expect((initGet?.headers as Record<string, string>).Authorization).toBe("Bearer EAAG-sistema");
    expect(urlPost).toBe("https://graph.facebook.com/v21.0/111/subscribed_apps?subscribed_fields=messages");
    expect((initPost?.headers as Record<string, string>).Authorization).toBe("Bearer EAAP-pagina");
    expect(H.igGuardar).toHaveBeenCalledWith("w1", "EAAP-pagina", 1);
    expect(H.igGuardar).not.toHaveBeenCalledWith("w1", "EAAG-sistema", expect.anything());
    expect(await leerConexion("w1")).toMatchObject({ igPageId: "111", igAccountId: "1784", igUsuario: "dnxestudio", igActivo: true, modo: "SIMULADO" });
    expect(JSON.stringify(B.datos.fotofficeWaConexion)).not.toContain("EAAP-pagina");
  });

  it("no cambia lo de WhatsApp de una conexión que ya existía", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", phoneNumberId: "123456", modo: "REAL", pausaBotHoras: 6 });
    expect(await conectarInstagram(ADMIN, { token: "EAAG" }, { fetch: metaIg([PAGINA]) })).toEqual({ ok: true });
    expect(await leerConexion("w1")).toMatchObject({ phoneNumberId: "123456", modo: "REAL", pausaBotHoras: 6, igActivo: true });
  });

  it("con varias páginas con Instagram elige la de la cuenta ya guardada", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", modo: "SIMULADO", igAccountId: "2000" });
    const otra = { id: "222", access_token: "EAAP-2", instagram_business_account: { id: "2000", username: "otra" } };
    expect(await conectarInstagram(ADMIN, { token: "EAAG" }, { fetch: metaIg([PAGINA, otra]) })).toEqual({ ok: true });
    expect(await leerConexion("w1")).toMatchObject({ igPageId: "222", igUsuario: "otra" });
  });

  it("token sin página con Instagram: error claro y no guarda nada", async () => {
    const r = await conectarInstagram(ADMIN, { token: "EAAG" }, { fetch: metaIg([{ id: "999", access_token: "x" }]) });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Ese token no ve ninguna página con Instagram vinculado") });
    expect(B.datos.fotofficeWaConexion).toHaveLength(0);
    expect(H.igGuardar).not.toHaveBeenCalled();
  });

  it("si Meta rechaza el token, muestra su motivo (nunca el token)", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token EAAG-secreto", code: 190 } }), { status: 400 })) as unknown as typeof fetch;
    const r = await conectarInstagram(ADMIN, { token: "EAAG-secreto" }, { fetch: f });
    expect(r).toMatchObject({ ok: false });
    const error = (r as { error: string }).error;
    expect(error).toContain("Invalid OAuth");
    expect(error).toContain("190");
    expect(error).not.toContain("EAAG-secreto");
  });

  it("si Meta no acepta suscribir la página, no queda activo y dice el motivo", async () => {
    const f = metaIg([PAGINA], new Response(JSON.stringify({ error: { message: "(#200) Permissions error", code: 200 } }), { status: 403 }));
    const r = await conectarInstagram(ADMIN, { token: "EAAG" }, { fetch: f });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Permissions error") });
    expect((r as { error: string }).error).not.toContain("EAAP-pagina");
    expect(B.datos.fotofficeWaConexion).toHaveLength(0);
    expect(H.igGuardar).not.toHaveBeenCalled();
  });

  it("sólo un administrador, y el token es obligatorio", async () => {
    const f = metaIg([PAGINA]);
    expect(await conectarInstagram(EQUIPO, { token: "EAAG" }, { fetch: f })).toMatchObject({ ok: false });
    expect(await conectarInstagram(ADMIN, { token: "  " }, { fetch: f })).toMatchObject({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });

  it("la misma cuenta de Instagram en otra institución choca con un mensaje claro", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w2", modo: "SIMULADO", igAccountId: "1784" });
    expect(await conectarInstagram(ADMIN, { token: "EAAG" }, { fetch: metaIg([PAGINA]) })).toMatchObject({ ok: false, error: expect.stringContaining("otra institución") });
    expect(H.igGuardar).not.toHaveBeenCalled();
  });

  it("si no se puede guardar el token de página, no queda activo", async () => {
    H.igGuardar.mockRejectedValue(new Error("sin clave"));
    expect(await conectarInstagram(ADMIN, { token: "EAAG" }, { fetch: metaIg([PAGINA]) })).toMatchObject({ ok: false });
    expect((await leerConexion("w1")).igActivo).toBe(false);
  });
});

describe("desconectarInstagram y estadoInstagram", () => {
  it("apaga Instagram, borra el token y conserva WhatsApp", async () => {
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", phoneNumberId: "123456", modo: "REAL", igAccountId: "1784", igPageId: "111", igUsuario: "dnxestudio", igActivo: true });
    expect(await desconectarInstagram(ADMIN)).toEqual({ ok: true });
    expect(H.igBorrar).toHaveBeenCalledWith("w1");
    expect(await leerConexion("w1")).toMatchObject({ igActivo: false, modo: "REAL", phoneNumberId: "123456" });
  });

  it("sólo un administrador", async () => {
    expect(await desconectarInstagram(EQUIPO)).toMatchObject({ ok: false });
    expect(H.igBorrar).not.toHaveBeenCalled();
  });

  it("conectado sólo si está activo y hay token; nunca el token", async () => {
    expect(await estadoInstagram("w1")).toEqual({ conectado: false, usuario: null });
    B.agregar("fotofficeWaConexion", { workspaceId: "w1", modo: "SIMULADO", igAccountId: "1784", igPageId: "111", igUsuario: "dnxestudio", igActivo: true });
    expect(await estadoInstagram("w1")).toEqual({ conectado: false, usuario: "dnxestudio" });
    H.igHay.mockResolvedValue(true);
    expect(await estadoInstagram("w1")).toEqual({ conectado: true, usuario: "dnxestudio" });
  });
});
