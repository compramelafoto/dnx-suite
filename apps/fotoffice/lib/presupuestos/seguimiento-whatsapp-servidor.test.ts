import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { seguirCotizacionesPorWhatsapp } = await import("./seguimiento-whatsapp-servidor");
type Deps = NonNullable<Parameters<typeof seguirCotizacionesPorWhatsapp>[0]>;

const AHORA = new Date("2026-11-20T13:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);
const CAND = {
  aprobacionId: "a1", workspaceId: "w1", leadId: "l1", entroPorElBot: true, waId: "5493410000000", enviadaEn: hace(3), nombre: "Lucía Pérez", categoria: "15 años",
  abierta: true, ruta: "w/dnx-estudio/presupuesto/tok", chat: { id: "c1", estado: "BOT", ultimoEntranteEn: hace(3.1) }, yaEnviados: 0,
};

function deps(extra: Partial<Deps> = {}) {
  const plantilla = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "wamid" }));
  const marcar = vi.fn(async () => undefined);
  const chatNuevo = vi.fn(async () => ({ id: "c-nuevo", estado: "BOT", ultimoEntranteEn: null as Date | null }));
  const d: Deps = { ahora: AHORA, candidatos: async () => [CAND], plantilla, marcar, chatNuevo, ...extra };
  return { d, plantilla, marcar, chatNuevo };
}

describe("seguirCotizacionesPorWhatsapp", () => {
  it("manda la plantilla con nombre, evento y la ruta del botón, y lo deja anotado", async () => {
    const { d, plantilla, marcar } = deps();
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 1, fallidas: 0 });
    expect(plantilla).toHaveBeenCalledWith("w1", "5493410000000", { nombre: "seguimiento_cotizacion", idioma: "es_AR", cuerpo: ["Lucía", "tus 15"], boton: "w/dnx-estudio/presupuesto/tok" }, "c1");
    expect(marcar).toHaveBeenCalledWith("w1", "c1", "Seguimiento de cotización 1 enviado por WhatsApp");
  });

  it("si Meta rechaza la plantilla (todavía no aprobada) no lo anota: se reintenta al día siguiente", async () => {
    const { d, marcar } = deps({ plantilla: async () => ({ ok: false as const, codigo: "132001" }) });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 0, fallidas: 1 });
    expect(marcar).not.toHaveBeenCalled();
  });

  it("en modo prueba no manda nada y devuelve a quién le escribiría", async () => {
    const { d, plantilla, marcar } = deps({ prueba: true });
    const r = await seguirCotizacionesPorWhatsapp(d);
    expect(r).toMatchObject({ revisadas: 1, enviadas: 0, prueba: [{ aprobacionId: "a1", numero: 1 }] });
    expect(plantilla).not.toHaveBeenCalled();
    expect(marcar).not.toHaveBeenCalled();
  });

  it("no le escribe a quien respondió después de recibir la cotización ni a un chat que atiende una persona", async () => {
    const respondio = deps({ candidatos: async () => [{ ...CAND, chat: { ...CAND.chat, ultimoEntranteEn: hace(1) } }] });
    expect(await seguirCotizacionesPorWhatsapp(respondio.d)).toMatchObject({ enviadas: 0 });
    expect(respondio.plantilla).not.toHaveBeenCalled();
    const persona = deps({ candidatos: async () => [{ ...CAND, chat: { ...CAND.chat, estado: "HUMANO" } }] });
    expect(await seguirCotizacionesPorWhatsapp(persona.d)).toMatchObject({ enviadas: 0 });
  });

  it("consulta de Instagram con teléfono y sin chat de WhatsApp: crea el chat y manda la plantilla ahí", async () => {
    const { d, plantilla, marcar, chatNuevo } = deps({ candidatos: async () => [{ ...CAND, waId: "+54 9 341 000-0000", chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 1, fallidas: 0 });
    expect(chatNuevo).toHaveBeenCalledWith("w1", "5493410000000", "l1", "Lucía Pérez", AHORA);
    expect(plantilla).toHaveBeenCalledWith("w1", "5493410000000", expect.objectContaining({ nombre: "seguimiento_cotizacion" }), "c-nuevo");
    expect(marcar).toHaveBeenCalledWith("w1", "c-nuevo", "Seguimiento de cotización 1 enviado por WhatsApp");
  });

  it("si el chat que aparece al crearlo ya lo atiende una persona, no manda nada", async () => {
    const { d, plantilla } = deps({
      candidatos: async () => [{ ...CAND, chat: null }],
      chatNuevo: async () => ({ id: "c-otro", estado: "HUMANO", ultimoEntranteEn: null }),
    });
    expect(await seguirCotizacionesPorWhatsapp(d)).toMatchObject({ enviadas: 0, fallidas: 0 });
    expect(plantilla).not.toHaveBeenCalled();
  });

  it("consulta del bot sin chat: con teléfono inválido o en modo prueba no crea nada", async () => {
    const invalido = deps({ candidatos: async () => [{ ...CAND, waId: "123", chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(invalido.d)).toMatchObject({ enviadas: 0, fallidas: 0 });
    expect(invalido.chatNuevo).not.toHaveBeenCalled();
    const prueba = deps({ prueba: true, candidatos: async () => [{ ...CAND, chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(prueba.d)).toMatchObject({ prueba: [{ aprobacionId: "a1", numero: 1 }] });
    expect(prueba.chatNuevo).not.toHaveBeenCalled();
  });

  it("consulta de WhatsApp con chat: usa ese chat y no crea otro (igual que antes)", async () => {
    const { d, plantilla, chatNuevo } = deps();
    await seguirCotizacionesPorWhatsapp(d);
    expect(chatNuevo).not.toHaveBeenCalled();
    expect(plantilla).toHaveBeenCalledWith("w1", "5493410000000", expect.anything(), "c1");
  });

  it("consulta de la web sin chat de WhatsApp: sigue sin seguimiento (no crea chat)", async () => {
    const { d, plantilla, chatNuevo } = deps({ candidatos: async () => [{ ...CAND, entroPorElBot: false, chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 0, fallidas: 0 });
    expect(chatNuevo).not.toHaveBeenCalled();
    expect(plantilla).not.toHaveBeenCalled();
  });
});
