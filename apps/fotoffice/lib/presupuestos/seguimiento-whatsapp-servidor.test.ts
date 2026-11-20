import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { seguirCotizacionesPorWhatsapp } = await import("./seguimiento-whatsapp-servidor");
type Deps = NonNullable<Parameters<typeof seguirCotizacionesPorWhatsapp>[0]>;

const AHORA = new Date("2026-11-20T13:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);
const CAND = {
  aprobacionId: "a1", workspaceId: "w1", leadId: "l1", presupuestoId: "p1", vista: false, entroPorElBot: true, waId: "5493410000000", enviadaEn: hace(3), nombre: "Lucía Pérez", categoria: "15 años",
  abierta: true, ruta: "w/dnx-estudio/presupuesto/tok", chat: { id: "c1", estado: "BOT", ultimoEntranteEn: hace(3.1) }, yaEnviados: 0, porCorreo: 0,
};

function deps(extra: Partial<Deps> = {}) {
  const marcar = vi.fn(async () => undefined);
  const chatNuevo = vi.fn(async () => ({ id: "c-nuevo", estado: "BOT", ultimoEntranteEn: null as Date | null }));
  const correo = vi.fn(async () => "ENVIADO" as const);
  const actividadDesde = vi.fn(async () => ({ vio: false, delEquipo: false }));
  const d: Deps = { ahora: AHORA, candidatos: async () => [CAND], marcar, chatNuevo, correo, actividadDesde, ...extra };
  return { d, marcar, chatNuevo, correo };
}

describe("seguirCotizacionesPorWhatsapp", () => {
  it("a los 2 días (si no salió el de la ventana de 24 h) manda el correo, no una plantilla, y lo anota", async () => {
    const { d, correo, marcar } = deps();
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 1, fallidas: 0 });
    expect(correo).toHaveBeenCalledWith("w1", "p1", 0);
    expect(marcar).toHaveBeenCalledWith("w1", "c1", "Seguimiento de cotización 1 enviado por correo");
  });

  it("si el correo falla no lo anota: se reintenta al día siguiente", async () => {
    const { d, marcar } = deps({ correo: async () => "FALLO" as const });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 0, fallidas: 1 });
    expect(marcar).not.toHaveBeenCalled();
  });

  it("en modo prueba no manda nada y devuelve a quién le escribiría", async () => {
    const { d, correo, marcar } = deps({ prueba: true });
    const r = await seguirCotizacionesPorWhatsapp(d);
    expect(r).toMatchObject({ revisadas: 1, enviadas: 0, prueba: [{ aprobacionId: "a1", numero: 1 }] });
    expect(correo).not.toHaveBeenCalled();
    expect(marcar).not.toHaveBeenCalled();
  });

  it("no le escribe a quien respondió después de recibir la cotización ni a un chat que atiende una persona", async () => {
    const respondio = deps({ candidatos: async () => [{ ...CAND, chat: { ...CAND.chat, ultimoEntranteEn: hace(1) } }] });
    expect(await seguirCotizacionesPorWhatsapp(respondio.d)).toMatchObject({ enviadas: 0 });
    expect(respondio.correo).not.toHaveBeenCalled();
    const persona = deps({ candidatos: async () => [{ ...CAND, chat: { ...CAND.chat, estado: "HUMANO" } }] });
    expect(await seguirCotizacionesPorWhatsapp(persona.d)).toMatchObject({ enviadas: 0 });
    expect(persona.correo).not.toHaveBeenCalled();
  });

  it("consulta de Instagram con teléfono y sin chat de WhatsApp: crea el chat para dejar la marca y manda el correo", async () => {
    const { d, correo, marcar, chatNuevo } = deps({ candidatos: async () => [{ ...CAND, waId: "+54 9 341 000-0000", chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 1, fallidas: 0 });
    expect(chatNuevo).toHaveBeenCalledWith("w1", "5493410000000", "l1", "Lucía Pérez", AHORA);
    expect(correo).toHaveBeenCalledWith("w1", "p1", 0);
    expect(marcar).toHaveBeenCalledWith("w1", "c-nuevo", "Seguimiento de cotización 1 enviado por correo");
  });

  it("si el chat que aparece al crearlo ya lo atiende una persona, no manda nada", async () => {
    const { d, correo } = deps({
      candidatos: async () => [{ ...CAND, chat: null }],
      chatNuevo: async () => ({ id: "c-otro", estado: "HUMANO", ultimoEntranteEn: null }),
    });
    expect(await seguirCotizacionesPorWhatsapp(d)).toMatchObject({ enviadas: 0, fallidas: 0 });
    expect(correo).not.toHaveBeenCalled();
  });

  it("consulta del bot sin chat: con teléfono inválido o en modo prueba no crea nada", async () => {
    const invalido = deps({ candidatos: async () => [{ ...CAND, waId: "123", chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(invalido.d)).toMatchObject({ enviadas: 0, fallidas: 0 });
    expect(invalido.chatNuevo).not.toHaveBeenCalled();
    const prueba = deps({ prueba: true, candidatos: async () => [{ ...CAND, chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(prueba.d)).toMatchObject({ prueba: [{ aprobacionId: "a1", numero: 1 }] });
    expect(prueba.chatNuevo).not.toHaveBeenCalled();
  });

  it("consulta de la web sin chat de WhatsApp: sigue sin seguimiento (no crea chat)", async () => {
    const { d, correo, chatNuevo } = deps({ candidatos: async () => [{ ...CAND, entroPorElBot: false, chat: null }] });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 0, fallidas: 0 });
    expect(chatNuevo).not.toHaveBeenCalled();
    expect(correo).not.toHaveBeenCalled();
  });

  it("a los 7 días, otro correo; cuenta los correos previos (el 1.º pudo ir por WhatsApp)", async () => {
    const porWa = deps({ candidatos: async () => [{ ...CAND, enviadaEn: hace(7), chat: { ...CAND.chat, ultimoEntranteEn: hace(7.1) }, yaEnviados: 1, porCorreo: 0 }] });
    await seguirCotizacionesPorWhatsapp(porWa.d);
    expect(porWa.correo).toHaveBeenCalledWith("w1", "p1", 0);
    expect(porWa.marcar).toHaveBeenCalledWith("w1", "c1", "Seguimiento de cotización 2 enviado por correo");
    const porMail = deps({ candidatos: async () => [{ ...CAND, enviadaEn: hace(7), chat: { ...CAND.chat, ultimoEntranteEn: hace(7.1) }, yaEnviados: 1, porCorreo: 1 }] });
    await seguirCotizacionesPorWhatsapp(porMail.d);
    expect(porMail.correo).toHaveBeenCalledWith("w1", "p1", 1);
  });

  it("a los 12 días, el tercero", async () => {
    const { d, correo, marcar } = deps({ candidatos: async () => [{ ...CAND, enviadaEn: hace(12), chat: { ...CAND.chat, ultimoEntranteEn: hace(12.1) }, yaEnviados: 2, porCorreo: 2 }] });
    await seguirCotizacionesPorWhatsapp(d);
    expect(correo).toHaveBeenCalledWith("w1", "p1", 2);
    expect(marcar).toHaveBeenCalledWith("w1", "c1", "Seguimiento de cotización 3 enviado por correo");
  });

  it("si dio señales de vida (la abrió, o el equipo le escribió o le cargó una cita), no manda el correo", async () => {
    const vio = deps({ actividadDesde: async () => ({ vio: true, delEquipo: false }) });
    expect(await seguirCotizacionesPorWhatsapp(vio.d)).toMatchObject({ enviadas: 0 });
    expect(vio.correo).not.toHaveBeenCalled();
    const equipo = deps({ actividadDesde: async () => ({ vio: false, delEquipo: true }) });
    await seguirCotizacionesPorWhatsapp(equipo.d);
    expect(equipo.correo).not.toHaveBeenCalled();
  });

  it("sin correo para mandar (salteado), no lo anota: se vuelve a mirar al día siguiente", async () => {
    const { d, marcar } = deps({ correo: async () => "SALTEADO" as const });
    expect(await seguirCotizacionesPorWhatsapp(d)).toEqual({ revisadas: 1, enviadas: 0, fallidas: 0 });
    expect(marcar).not.toHaveBeenCalled();
  });
});
