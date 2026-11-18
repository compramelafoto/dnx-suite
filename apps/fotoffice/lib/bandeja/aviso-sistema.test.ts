import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn(async () => null), hayTokenWhatsapp: vi.fn(async () => true), guardarTokenWhatsapp: vi.fn() }));
const IG_TOKEN = vi.hoisted(() => ({ hay: true }));
vi.mock("@/lib/integrations/instagram/credentials", () => ({ leerTokenInstagram: vi.fn(async () => null), hayTokenInstagram: vi.fn(async () => IG_TOKEN.hay) }));

const { enviarAvisoAlChat, enviarAvisoPorWhatsapp, estadoInstagramDe } = await import("./aviso-sistema");

const AHORA = new Date("2026-11-18T15:00:00.000Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const mensajes = () => B.datos.fotofficeWaMensaje;
const IGSID = "5550001";
const WA = "5493413419869";

async function conexionReal() {
  await P.fotofficeWaConexion.create({ data: { workspaceId: "w1", modo: "REAL", phoneNumberId: "123", igAccountId: "1784", igPageId: "pg1", igActivo: true } });
}
const chatDe = async (canal: string, waId: string, ultimoEntranteEn: Date | null = hace(1)) =>
  (await P.fotofficeWaChat.create({ data: { workspaceId: "w1", canal, waId, ultimoMensajeEn: hace(1), ultimoEntranteEn } })) as { id: string };

beforeEach(() => {
  B.vaciar();
  IG_TOKEN.hay = true;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("enviarAvisoAlChat", () => {
  it("chat de Instagram con la ventana abierta: envía por Instagram y queda ENVIADO con el mid", async () => {
    await conexionReal();
    const { id } = await chatDe("INSTAGRAM", IGSID);
    const enviar = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "m_1" }));
    expect(await enviarAvisoAlChat("w1", id, "Tu presupuesto está listo", { ahora: AHORA, enviar })).toBe("ENVIADO");
    expect(enviar).toHaveBeenCalledTimes(1);
    const [conexion, destino, texto, deps, canal] = enviar.mock.calls[0] as unknown as [Record<string, unknown>, string, string, unknown, string];
    expect(conexion).toMatchObject({ igPageId: "pg1", igActivo: true });
    expect([destino, texto, canal]).toEqual([IGSID, "Tu presupuesto está listo", "INSTAGRAM"]);
    expect(deps).toEqual({});
    expect(mensajes()[0]).toMatchObject({ chatId: id, direccion: "SALIENTE", autor: "BOT", estadoEnvio: "ENVIADO", waMessageId: "m_1" });
  });

  it("Instagram apagado o sin página: SIN_CONEXION sin dejar mensaje", async () => {
    await P.fotofficeWaConexion.create({ data: { workspaceId: "w1", modo: "REAL", phoneNumberId: "123", igPageId: "pg1", igActivo: false } });
    const { id } = await chatDe("INSTAGRAM", IGSID);
    const enviar = vi.fn();
    expect(await enviarAvisoAlChat("w1", id, "hola", { ahora: AHORA, enviar })).toBe("SIN_CONEXION");
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it("ventana cerrada: no envía", async () => {
    await conexionReal();
    const { id } = await chatDe("INSTAGRAM", IGSID, hace(25));
    const enviar = vi.fn();
    expect(await enviarAvisoAlChat("w1", id, "hola", { ahora: AHORA, enviar })).toBe("VENTANA_CERRADA");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("chat de otra institución: VENTANA_CERRADA sin enviar", async () => {
    await conexionReal();
    const otro = (await P.fotofficeWaChat.create({ data: { workspaceId: "w2", canal: "INSTAGRAM", waId: IGSID, ultimoMensajeEn: hace(1), ultimoEntranteEn: hace(1) } })) as { id: string };
    const enviar = vi.fn();
    expect(await enviarAvisoAlChat("w1", otro.id, "hola", { ahora: AHORA, enviar })).toBe("VENTANA_CERRADA");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("el eco de Instagram ya le puso el mismo mid: guarda ENVIADO sin fallar", async () => {
    await conexionReal();
    const { id } = await chatDe("INSTAGRAM", IGSID);
    const enviar = vi.fn(async () => {
      // El registro del webhook asignó el mid del eco antes de que vuelva la API.
      const m = mensajes().find((x) => x.chatId === id && x.direccion === "SALIENTE");
      Object.assign(m!, { waMessageId: "m_eco" });
      return { ok: true as const, simulado: false as const, waMessageId: "m_eco" };
    });
    expect(await enviarAvisoAlChat("w1", id, "hola", { ahora: AHORA, enviar })).toBe("ENVIADO");
    expect(mensajes().filter((m) => m.waMessageId === "m_eco")).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ estadoEnvio: "ENVIADO", waMessageId: "m_eco" });
  });

  it("si otra fila ya tiene ese mid: deja ENVIADO igual (sin el id) y lo loguea", async () => {
    await conexionReal();
    const { id } = await chatDe("INSTAGRAM", IGSID);
    await P.fotofficeWaMensaje.create({ data: { workspaceId: "w1", chatId: id, direccion: "SALIENTE", autor: "CELULAR", tipo: "TEXTO", texto: "x", estadoEnvio: "ENVIADO", waMessageId: "m_dup", createdAt: hace(2) } });
    const enviar = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "m_dup" }));
    expect(await enviarAvisoAlChat("w1", id, "hola", { ahora: AHORA, enviar })).toBe("ENVIADO");
    const aviso = mensajes().find((m) => m.autor === "BOT");
    expect(aviso).toMatchObject({ estadoEnvio: "ENVIADO", waMessageId: null });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("enviarAvisoPorWhatsapp (sin cambios)", () => {
  it("busca el chat de WhatsApp por número y envía por WhatsApp, aunque haya uno de Instagram con los mismos dígitos", async () => {
    await conexionReal();
    await chatDe("INSTAGRAM", WA);
    const wa = await chatDe("WHATSAPP", WA);
    const enviar = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "wamid.1" }));
    expect(await enviarAvisoPorWhatsapp("w1", WA, "hola", { ahora: AHORA, enviar, autor: "Pedidos" })).toBe("ENVIADO");
    // La llamada de siempre: sin canal (WhatsApp por omisión).
    expect(enviar.mock.calls[0] as unknown as unknown[]).toHaveLength(3);
    expect((enviar.mock.calls[0] as unknown as unknown[])[1]).toBe(WA);
    expect(mensajes()[0]).toMatchObject({ chatId: wa.id, autorLabel: "Pedidos", estadoEnvio: "ENVIADO", waMessageId: "wamid.1" });
  });

  it("sólo hay chat de Instagram con esos dígitos: VENTANA_CERRADA", async () => {
    await conexionReal();
    await chatDe("INSTAGRAM", WA);
    const enviar = vi.fn();
    expect(await enviarAvisoPorWhatsapp("w1", WA, "hola", { ahora: AHORA, enviar })).toBe("VENTANA_CERRADA");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("conexión simulada: SIN_CONEXION", async () => {
    await P.fotofficeWaConexion.create({ data: { workspaceId: "w1", modo: "SIMULADO" } });
    await chatDe("WHATSAPP", WA);
    expect(await enviarAvisoPorWhatsapp("w1", WA, "hola", { ahora: AHORA, enviar: vi.fn() })).toBe("SIN_CONEXION");
  });
});

describe("estadoInstagramDe", () => {
  it("conectado sólo con REAL, Instagram activo, página y token; la ventana es la del chat de Instagram", async () => {
    await conexionReal();
    const { id } = await chatDe("INSTAGRAM", IGSID);
    expect(await estadoInstagramDe("w1", id, AHORA)).toEqual({ conectado: true, ventanaAbierta: true });
    IG_TOKEN.hay = false;
    expect(await estadoInstagramDe("w1", id, AHORA)).toEqual({ conectado: false, ventanaAbierta: true });
  });

  it("Instagram apagado: no conectado; un chat de WhatsApp con ese id no cuenta", async () => {
    await P.fotofficeWaConexion.create({ data: { workspaceId: "w1", modo: "REAL", phoneNumberId: "123", igPageId: "pg1", igActivo: false } });
    const ig = await chatDe("INSTAGRAM", IGSID, hace(30));
    const wa = await chatDe("WHATSAPP", WA);
    expect(await estadoInstagramDe("w1", ig.id, AHORA)).toEqual({ conectado: false, ventanaAbierta: false });
    expect((await estadoInstagramDe("w1", wa.id, AHORA)).ventanaAbierta).toBe(false);
  });
});

