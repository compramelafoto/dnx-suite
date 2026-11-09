import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail, SendDeps, SendOutcome } from "@/lib/communications/send-email";
import type { ClienteClaude } from "../claude";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const telegram = vi.hoisted(() => ({
  mensajes: [] as Array<{ html: string; teclado: unknown }>,
  sinBotones: [] as string[],
  destino: { token: "tok", chatId: "chat" } as { token: string; chatId: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));
vi.mock("../canal", () => ({
  destinoAgentes: async () => telegram.destino,
  mandarMensaje: async (_t: string, _c: string, html: string, teclado: unknown) => {
    telegram.mensajes.push({ html, teclado });
    return { ok: true, resultado: { messageId: String(500 + telegram.mensajes.length) } };
  },
  cambiarBotones: async (_t: string, _c: string, messageId: string) => {
    telegram.sinBotones.push(messageId);
    return { ok: true, resultado: true };
  },
}));

const M = await import("./modelos");
const { guardarAjustesVendedor } = await import("./ajustes");
const { CLAVE_CAMPANA_ESCOLAR, CLAVE_CONOCIMIENTO } = await import("./clf");
const { tecladoModelo } = await import("./botones");

type Fila = Record<string, unknown>;

const AHORA = new Date("2026-11-20T15:00:00.000Z");

// --- Dobles -----------------------------------------------------------------------------------

let enviados: OutboundEmail[] = [];
let n = 0;
const enviar = async (m: OutboundEmail, _d: SendDeps = {}): Promise<SendOutcome> => {
  enviados.push(m);
  return { status: "SENT", providerId: `re_out_${++n}` };
};

let respuestasClaude: unknown[] = [];
let pedidosClaude: string[] = [];
const cliente: ClienteClaude = {
  beta: {
    messages: {
      create: async (body) => {
        pedidosClaude.push(JSON.stringify(body));
        const r = respuestasClaude.shift();
        if (!r) throw new Error("Claude no tenía que ser llamado");
        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "```json\n" + JSON.stringify(r) + "\n```", citations: null }],
          usage: { input_tokens: 1000, output_tokens: 500 },
        } as never;
      },
    },
  },
};
const modeloClaude = (asunto = "Una idea para tus fotos escolares") =>
  respuestasClaude.push({
    asunto,
    cuerpo: "Hola, vi tu trabajo en Rosario. Te cuento cómo vender tus fotos escolares: {{ENLACE}}",
    indicaciones: "Nombrar la ciudad y el nicho.",
    landing: "/land/fotografo-escolar",
  });

const deps = (ahora: Date = AHORA) => ({ ahora: () => ahora, claude: { cliente }, enviar, telegram: {}, hasta: Date.now() + 60_000 });

// --- Datos ------------------------------------------------------------------------------------

let nContacto = 0;
function contacto(o: { tipo?: string; estado?: string } = {}): string {
  const email = `estudio${++nContacto}@luz.com.ar`;
  const c = B.agregar("dnxContacto", {
    tipo: o.tipo ?? "FOTOGRAFO", nichos: ["ESCOLAR"], nombre: `Estudio Luz ${nContacto}`, ciudad: "Rosario", provincia: "Santa Fe",
    creadoPor: "BUSCADOR", email, claveEmail: email, estado: o.estado ?? "NUEVO",
  }) as { id: string };
  return c.id;
}

const modelos = () => B.datos.dnxVendedorModelo as Fila[];
const modelo = (id: string) => modelos().find((m) => m.id === id)!;
const hilos = () => B.datos.dnxVendedorHilo as Fila[];

async function proponer(grupo: "FOTOGRAFO:ESCOLAR" | "CLUB" = "FOTOGRAFO:ESCOLAR", ahora: Date = AHORA) {
  modeloClaude();
  const r = await M.proponerModelo(grupo, contacto(), deps(ahora));
  if (!r.ok) throw new Error(`no se propuso: ${r.motivo}`);
  return r.modeloId;
}

/** Un hilo que espera a Daniel, con su primer correo, la respuesta del contacto y una propuesta. */
function esperaDaniel(o: { propuesta?: string | null; telegramMessageId?: string; correcciones?: number } = {}) {
  const contactoId = contacto({ estado: "RESPONDIO" });
  const email = (B.datos.dnxContacto.find((c) => c.id === contactoId) as Fila).email as string;
  const hilo = B.agregar("dnxVendedorHilo", {
    contactoId, grupo: "FOTOGRAFO:ESCOLAR", token: `tok${contactoId.slice(-6)}`, estado: "ESPERA_DANIEL",
    telegramMessageId: o.telegramMessageId ?? "900", correcciones: o.correcciones ?? 0,
  }) as { id: string };
  B.agregar("dnxVendedorCorreo", {
    hiloId: hilo.id, contactoId, direccion: "SALIDA", paso: "PRIMERO", resendId: `re_primero_${hilo.id}`,
    messageId: `<primero-${hilo.id}@resend.dev>`, de: "Daniel Cuart <daniel@compramelafoto.com>", para: email,
    asunto: "Una idea para tus fotos escolares", texto: "Hola, te escribo por tus fotos.", creadoEn: new Date("2026-11-18T13:00:00.000Z"),
  });
  const entrante = B.agregar("dnxVendedorCorreo", {
    hiloId: hilo.id, contactoId, direccion: "ENTRADA", resendId: `in_${hilo.id}`, messageId: `<resp-${hilo.id}@mail.gmail.com>`,
    de: email, para: "daniel@compramelafoto.com", asunto: "Re: Una idea para tus fotos escolares",
    texto: "¿Me hacés un precio especial?", clase: "DELICADA", procesadoEn: AHORA, creadoEn: new Date("2026-11-19T13:00:00.000Z"),
  }) as { id: string };
  const propuesta = o.propuesta === undefined ? "Los precios son los de la página: {{ENLACE}}" : o.propuesta;
  const h = hilos().find((x) => x.id === hilo.id)!;
  h.propuesta = propuesta === null ? null : { texto: propuesta, entranteId: entrante.id };
  return { hiloId: hilo.id, contactoId, email, entranteId: entrante.id };
}

beforeEach(async () => {
  B.vaciar();
  enviados = [];
  respuestasClaude = [];
  pedidosClaude = [];
  telegram.mensajes = [];
  telegram.sinBotones = [];
  telegram.destino = { token: "tok", chatId: "chat" };
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fotoffice.com");
  vi.stubEnv("FOTOFFICE_MAILING_SECRET", "secreto-de-prueba");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("VENDEDOR_RESEND_API_KEY", "");
  await guardarAjustesVendedor({ pausado: false });
  B.agregar("systemSettings", { key: CLAVE_CONOCIMIENTO, value: JSON.stringify({ texto: "CompraMeLaFoto vende fotos.", version: "v1" }) });
  B.agregar("systemSettings", { key: CLAVE_CAMPANA_ESCOLAR, value: JSON.stringify({ emails: [], traidoEn: AHORA.toISOString() }) });
  return () => vi.unstubAllEnvs();
});

describe("modelos por grupo", () => {
  it("aprobar deja el modelo vigente y encola el correo del contacto de ejemplo", async () => {
    const contactoId = contacto();
    modeloClaude();
    const r = await M.proponerModelo("FOTOGRAFO:ESCOLAR", contactoId, deps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(modelo(r.modeloId)).toMatchObject({
      grupo: "FOTOGRAFO:ESCOLAR", estado: "PROPUESTO", contactoEjemploId: contactoId, telegramMessageId: "501",
      asunto: "Una idea para tus fotos escolares", landing: "/land/fotografo-escolar",
    });
    expect(telegram.mensajes).toHaveLength(1);
    expect(telegram.mensajes[0]!.html).toContain("Fotógrafos escolares");
    expect(telegram.mensajes[0]!.html).toContain("Una idea para tus fotos escolares");
    expect(telegram.mensajes[0]!.html.trim().endsWith("Para corregir, respondé a este mensaje con lo que querés cambiar.")).toBe(true);
    expect(telegram.mensajes[0]!.teclado).toEqual(tecladoModelo(r.modeloId));
    expect(B.datos.dnxVendedorGasto).toEqual([expect.objectContaining({ motivo: "MODELO", modeloId: r.modeloId })]);
    expect(await M.modeloVigente("FOTOGRAFO:ESCOLAR")).toBeNull();

    const a = await M.aprobarModelo(r.modeloId, deps());
    expect(a.ok).toBe(true);
    expect(modelo(r.modeloId)).toMatchObject({ estado: "APROBADO", aprobadoPor: "DANIEL", aprobadoEn: AHORA, reemplazadoEn: null });
    expect((await M.modeloVigente("FOTOGRAFO:ESCOLAR"))?.id).toBe(r.modeloId);
    expect(hilos()).toHaveLength(1);
    expect(hilos()[0]).toMatchObject({
      contactoId, grupo: "FOTOGRAFO:ESCOLAR", modeloId: r.modeloId, estado: "PENDIENTE_ENVIO",
      borrador: { asunto: "Una idea para tus fotos escolares", cuerpo: expect.stringContaining("{{ENLACE}}") },
    });
    expect(hilos()[0]!.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("si el contacto de ejemplo ya no es apto, aprueba sin crearle hilo", async () => {
    const id = await proponer();
    const c = B.datos.dnxContacto.find((x) => x.id === modelo(id).contactoEjemploId)!;
    c.estado = "NO_CONTACTAR";
    const a = await M.aprobarModelo(id, deps());
    expect(a.ok).toBe(true);
    expect(modelo(id).estado).toBe("APROBADO");
    expect(hilos()).toHaveLength(0);
  });

  it("mientras el nuevo está propuesto sigue vigente el anterior; al aprobarlo lo reemplaza", async () => {
    const viejo = B.agregar("dnxVendedorModelo", {
      grupo: "FOTOGRAFO:ESCOLAR", estado: "APROBADO", asunto: "Viejo", cuerpo: "Viejo {{ENLACE}}", indicaciones: "", landing: "/land",
      aprobadoPor: "DANIEL", aprobadoEn: new Date("2026-11-01T12:00:00.000Z"), creadoEn: new Date("2026-11-01T12:00:00.000Z"),
    }) as { id: string };
    const nuevo = await proponer();
    expect((await M.modeloVigente("FOTOGRAFO:ESCOLAR"))?.id).toBe(viejo.id);

    expect((await M.aprobarModelo(nuevo, deps())).ok).toBe(true);
    expect(modelo(viejo.id)).toMatchObject({ estado: "APROBADO", reemplazadoEn: AHORA });
    expect(modelo(nuevo)).toMatchObject({ estado: "APROBADO", reemplazadoEn: null });
    expect((await M.modeloVigente("FOTOGRAFO:ESCOLAR"))?.id).toBe(nuevo);
  });

  it("no hay dos propuestos por grupo", async () => {
    await proponer();
    const r = await M.proponerModelo("FOTOGRAFO:ESCOLAR", contacto(), deps(new Date("2026-11-23T15:00:00.000Z")));
    expect(r).toEqual({ ok: false, motivo: "YA_HAY_PROPUESTO" });
    expect(pedidosClaude).toHaveLength(1);
    expect(modelos().filter((m) => m.estado === "PROPUESTO")).toHaveLength(1);
  });

  it("un grupo descartado hoy no se vuelve a proponer hasta mañana", async () => {
    const id = await proponer();
    const d = await M.descartarModelo(id);
    expect(d.ok).toBe(true);
    expect(modelo(id).estado).toBe("DESCARTADO");
    expect((await M.descartarModelo(id)).ok).toBe(false);

    // 23:30 del mismo día argentino.
    const r = await M.proponerModelo("FOTOGRAFO:ESCOLAR", contacto(), deps(new Date("2026-11-21T02:30:00.000Z")));
    expect(r).toEqual({ ok: false, motivo: "YA_PROPUESTO_HOY" });
    expect(pedidosClaude).toHaveLength(1);
    // 0:30 del día siguiente.
    modeloClaude();
    const otro = await M.proponerModelo("FOTOGRAFO:ESCOLAR", contacto(), deps(new Date("2026-11-21T03:30:00.000Z")));
    expect(otro.ok).toBe(true);
  });

  it("clubes no se propone ni se aprueba sin la página publicada", async () => {
    const r = await M.proponerModelo("CLUB", contacto({ tipo: "CLUB" }), deps());
    expect(r).toEqual({ ok: false, motivo: "CLUBES_SIN_PAGINA" });
    expect(pedidosClaude).toHaveLength(0);

    const m = B.agregar("dnxVendedorModelo", {
      grupo: "ORGANIZADOR_EVENTOS", asunto: "Fotos de tu evento", cuerpo: "Hola {{ENLACE}}", indicaciones: "", landing: "/clubes",
    }) as { id: string };
    const a = await M.aprobarModelo(m.id, deps());
    expect(a.ok).toBe(false);
    expect(a.texto).toContain("La página de clubes todavía no está publicada");
    expect(modelo(m.id).estado).toBe("PROPUESTO");

    await guardarAjustesVendedor({ paginaClubesPublicada: true });
    expect((await M.aprobarModelo(m.id, deps())).ok).toBe(true);
    modeloClaude();
    expect((await M.proponerModelo("CLUB", contacto({ tipo: "CLUB" }), deps())).ok).toBe(true);
  });

  it("aprobar dos veces no crea dos hilos", async () => {
    const id = await proponer();
    expect((await M.aprobarModelo(id, deps())).ok).toBe(true);
    const otra = await M.aprobarModelo(id, deps());
    expect(otra.ok).toBe(false);
    expect(hilos()).toHaveLength(1);
    expect(modelos().filter((m) => m.estado === "APROBADO")).toHaveLength(1);
  });

  it("sin Telegram, sin conocimiento o con el tope no llama a Claude", async () => {
    telegram.destino = null;
    expect(await M.proponerModelo("FOTOGRAFO:ESCOLAR", contacto(), deps())).toEqual({ ok: false, motivo: "SIN_TELEGRAM" });
    telegram.destino = { token: "tok", chatId: "chat" };
    await guardarAjustesVendedor({ topeClaudeUsd: 0 });
    expect(await M.proponerModelo("FOTOGRAFO:ESCOLAR", contacto(), deps())).toEqual({ ok: false, motivo: "TOPE" });
    await guardarAjustesVendedor({ topeClaudeUsd: 30 });
    B.datos.systemSettings = B.datos.systemSettings.filter((s) => s.key !== CLAVE_CONOCIMIENTO);
    expect(await M.proponerModelo("FOTOGRAFO:ESCOLAR", contacto(), deps())).toEqual({ ok: false, motivo: "SIN_CONOCIMIENTO" });
    expect(pedidosClaude).toHaveLength(0);
    expect(modelos()).toHaveLength(0);
  });

  it("corregir rehace con la indicación, manda un mensaje nuevo y respeta el tope de 5", async () => {
    const id = await proponer();
    expect(await M.esMensajeDelVendedor("501")).toBe(true);
    expect(await M.esMensajeDelVendedor("12345")).toBe(false);

    modeloClaude("Vendé tus fotos escolares");
    await M.corregirVendedor("501", "más corto y sin vueltas", deps());
    expect(pedidosClaude).toHaveLength(2);
    expect(pedidosClaude[1]).toContain("más corto y sin vueltas");
    expect(pedidosClaude[1]).toContain("Versión anterior");
    expect(modelo(id)).toMatchObject({ estado: "PROPUESTO", asunto: "Vendé tus fotos escolares", correcciones: 1 });
    const nuevo = telegram.mensajes.at(-1)!;
    expect(nuevo.html).toContain("Vendé tus fotos escolares");
    expect(nuevo.teclado).toEqual(tecladoModelo(id));
    expect(modelo(id).telegramMessageId).toBe(String(500 + telegram.mensajes.length));
    expect(telegram.sinBotones).toContain("501");
    expect(B.datos.dnxVendedorGasto.filter((g) => g.motivo === "CORRECCION" && g.modeloId === id)).toHaveLength(1);

    modelo(id).correcciones = M.MAX_CORRECCIONES_VENDEDOR;
    const antes = telegram.mensajes.length;
    await M.corregirVendedor(modelo(id).telegramMessageId as string, "otra vez", deps());
    expect(pedidosClaude).toHaveLength(2);
    expect(telegram.mensajes.at(-1)!.html).toContain("5 veces");
    expect(telegram.mensajes).toHaveLength(antes + 1);

    // Una respuesta que espera a Daniel también se corrige respondiendo a su mensaje.
    const h = esperaDaniel({ telegramMessageId: "900" });
    expect(await M.esMensajeDelVendedor("900")).toBe(true);
    respuestasClaude.push({ clase: "DELICADA", resumen: "Pide precio", quiereCapacitarse: false, respuesta: "Los precios están en la página." });
    await M.corregirVendedor("900", "decile que los precios están en la página", deps());
    expect(pedidosClaude.at(-1)).toContain("decile que los precios están en la página");
    const hilo = hilos().find((x) => x.id === h.hiloId)!;
    expect(hilo).toMatchObject({
      estado: "ESPERA_DANIEL", correcciones: 1, propuesta: { texto: "Los precios están en la página.", entranteId: h.entranteId },
    });
    expect(hilo.telegramMessageId).toBe(String(500 + telegram.mensajes.length));
    expect(telegram.mensajes.at(-1)!.html).toContain("Los precios están en la página.");
    expect(B.datos.dnxVendedorGasto.filter((g) => g.motivo === "CORRECCION" && g.hiloId === h.hiloId)).toHaveLength(1);
  });

  it("Enviar manda la propuesta en el hilo", async () => {
    const h = esperaDaniel();
    const r = await M.procesarBotonVendedor({ accion: "ENVIAR", id: h.hiloId }, deps());
    expect(r.ok).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.to).toBe(h.email);
    expect(enviados[0]!.text).toContain("Los precios son los de la página: https://www.compramelafoto.com/land/fotografo-escolar?dnxv=");
    expect(enviados[0]!.headers?.["In-Reply-To"]).toBe(`<resp-${h.hiloId}@mail.gmail.com>`);
    expect(B.datos.dnxVendedorCorreo.filter((c) => c.direccion === "SALIDA" && c.paso === "RESPUESTA")).toHaveLength(1);
    expect(hilos().find((x) => x.id === h.hiloId)).toMatchObject({ estado: "RESPONDIO", propuesta: null });

    const otra = await M.enviarRespuestaPropuesta(h.hiloId, deps());
    expect(otra.ok).toBe(false);
    expect(enviados).toHaveLength(1);
  });

  it("Enviar no manda si el contacto pasó a NO_CONTACTAR", async () => {
    const h = esperaDaniel();
    (B.datos.dnxContacto.find((c) => c.id === h.contactoId) as Fila).estado = "NO_CONTACTAR";
    const r = await M.procesarBotonVendedor({ accion: "ENVIAR", id: h.hiloId }, deps());
    expect(r).toEqual({ ok: false, texto: "Pidió no recibir más correos. Tocá «Lo contesto yo»." });
    expect(enviados).toHaveLength(0);
    expect(hilos().find((x) => x.id === h.hiloId)).toMatchObject({ estado: "ESPERA_DANIEL", propuesta: { entranteId: h.entranteId } });
  });

  it("Lo contesto yo deja el hilo en manual y lo reenvía a Gmail", async () => {
    const h = esperaDaniel();
    const r = await M.procesarBotonVendedor({ accion: "YO", id: h.hiloId }, deps());
    expect(r.ok).toBe(true);
    expect(hilos().find((x) => x.id === h.hiloId)).toMatchObject({ estado: "RESPONDIO", modoManual: true, propuesta: null });
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.to).toBe("dnxfotografia@gmail.com");
    expect(enviados[0]!.replyTo).toBe(h.email);
    expect(enviados[0]!.text).toContain("¿Me hacés un precio especial?");

    // Sin propuesta también se puede: reenvía el último correo que entró.
    const sin = esperaDaniel({ propuesta: null, telegramMessageId: "901" });
    expect((await M.loContestoYo(sin.hiloId, deps())).ok).toBe(true);
    expect(enviados).toHaveLength(2);
    expect(hilos().find((x) => x.id === sin.hiloId)).toMatchObject({ estado: "RESPONDIO", modoManual: true });
  });
});
