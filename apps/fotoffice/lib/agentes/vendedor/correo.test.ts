import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail, SendDeps, SendOutcome } from "@/lib/communications/send-email";
import { verifyUnsubscribeToken } from "@/lib/mailing/unsubscribe-token";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("./correo");

type Llamada = { mensaje: OutboundEmail; env: Record<string, string | undefined> };
let llamadas: Llamada[] = [];
let resultado: SendOutcome = { status: "SENT", providerId: "re_1" };
const enviar = async (mensaje: OutboundEmail, deps: SendDeps = {}): Promise<SendOutcome> => {
  llamadas.push({ mensaje, env: deps.env ?? {} });
  return resultado;
};

const ENV = { RESEND_API_KEY: "clave-general", FOTOFFICE_NOTIFICATIONS_FROM: "FOTOFFICE <hola@fotoffice.com>" };
const sinMessageId = async () => null;

const entrada = (extra: Partial<Parameters<typeof C.enviarCorreoVendedor>[0]> = {}) => ({
  hiloId: "h1",
  contactoId: "c1",
  para: "ana@estudio.com",
  asunto: "Una idea para tus fotos",
  texto: "Hola Ana",
  paso: "PRIMERO" as const,
  claveIdempotencia: "dnx-vendedor:h1:PRIMERO",
  ...extra,
});

beforeEach(() => {
  B.vaciar();
  llamadas = [];
  resultado = { status: "SENT", providerId: "re_1" };
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fotoffice.com");
  vi.stubEnv("FOTOFFICE_MAILING_SECRET", "secreto-de-prueba");
});
afterEach(() => vi.unstubAllEnvs());

describe("envío del Vendedor", () => {
  it("sale de Daniel con reply-to, baja en un clic y clave de idempotencia", async () => {
    const r = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(r.ok).toBe(true);
    const [l] = llamadas;
    expect(l!.env.FOTOFFICE_NOTIFICATIONS_FROM).toBe("Daniel Cuart <daniel@compramelafoto.com>");
    expect(l!.env.RESEND_API_KEY).toBe("clave-general");
    expect(l!.mensaje.replyTo).toBe("daniel@compramelafoto.com");
    expect(l!.mensaje.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(l!.mensaje.headers?.["List-Unsubscribe"]).toMatch(/^<https:\/\/fotoffice\.com\/api\/correo\/baja-dnx\?t=.+>$/);
    expect(l!.mensaje.idempotencyKey).toBe("dnx-vendedor:h1:PRIMERO");
    expect(l!.mensaje.to).toBe("ana@estudio.com");
    expect(l!.mensaje.text).toBe("Hola Ana");
    expect(l!.mensaje.subject).toBe("Una idea para tus fotos");
  });

  it("a un contacto NO_CONTACTAR no le sale nada salvo el reenvío a Daniel", async () => {
    const c = B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: "Ana", creadoPor: "BUSCADOR", estado: "NO_CONTACTAR" }) as { id: string };
    for (const paso of ["PRIMERO", "RECORDATORIO", "RESPUESTA"] as const) {
      const r = await C.enviarCorreoVendedor(entrada({ contactoId: c.id, paso, claveIdempotencia: `k-${paso}` }), { enviar, env: ENV, traerMessageId: sinMessageId });
      expect(r).toEqual({ ok: false, motivo: "NO_CONTACTAR", reintentable: false });
    }
    expect(llamadas).toHaveLength(0);
    const reenvio = await C.enviarCorreoVendedor(
      entrada({ contactoId: c.id, para: "dnxfotografia@gmail.com", paso: "REENVIO", claveIdempotencia: "k-reenvio" }),
      { enviar, env: ENV, traerMessageId: sinMessageId },
    );
    expect(reenvio.ok).toBe(true);
    expect(llamadas).toHaveLength(1);
  });

  it("frena por la dirección: otra ficha con el mismo correo en NO_CONTACTAR bloquea al hermano", async () => {
    B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: "Ana A", creadoPor: "BUSCADOR", email: "Ana@Estudio.com", claveEmail: "ana@estudio.com", estado: "NO_CONTACTAR" });
    const hermano = B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: "Ana B", creadoPor: "BUSCADOR", email: "ana@estudio.com", claveEmail: "ana@estudio.com" }) as { id: string };
    const r = await C.enviarCorreoVendedor(entrada({ contactoId: hermano.id }), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(r).toEqual({ ok: false, motivo: "NO_CONTACTAR", reintentable: false });
    expect(llamadas).toHaveLength(0);
  });

  it("una casilla dada de baja sin contacto no recibe nada (tampoco una respuesta a un tercero)", async () => {
    B.agregar("dnxVendedorBaja", { email: "info@club.com" });
    const c = B.agregar("dnxContacto", { tipo: "CLUB", nombre: "Juan", creadoPor: "BUSCADOR", email: "juan@club.com", claveEmail: "juan@club.com", estado: "CONTACTADO" }) as { id: string };
    const r = await C.enviarCorreoVendedor(
      entrada({ contactoId: c.id, para: "INFO@club.com", paso: "RESPUESTA", claveIdempotencia: "k-r" }),
      { enviar, env: ENV, traerMessageId: sinMessageId },
    );
    expect(r).toEqual({ ok: false, motivo: "NO_CONTACTAR", reintentable: false });
    expect(llamadas).toHaveLength(0);
  });

  it("el reenvío a Daniel no queda en la ficha del contacto como correo enviado", async () => {
    const c = B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: "Ana", creadoPor: "BUSCADOR" }) as { id: string };
    const r = await C.enviarCorreoVendedor(
      entrada({ contactoId: c.id, para: "dnxfotografia@gmail.com", paso: "REENVIO", claveIdempotencia: "k-reenvio" }),
      { enviar, env: ENV, traerMessageId: sinMessageId },
    );
    expect(r.ok).toBe(true);
    expect(B.datos.dnxContactoEvento).toHaveLength(0);
  });

  it("usa VENDEDOR_RESEND_API_KEY si está", async () => {
    await C.enviarCorreoVendedor(entrada(), { enviar, env: { ...ENV, VENDEDOR_RESEND_API_KEY: "clave-vendedor" }, traerMessageId: sinMessageId });
    expect(llamadas[0]!.env.RESEND_API_KEY).toBe("clave-vendedor");
  });

  it("un reenvío a Daniel no lleva baja y respeta el responder-a pedido", async () => {
    await C.enviarCorreoVendedor(
      entrada({ paso: "REENVIO", para: "dnxfotografia@gmail.com", responderA: "ana@estudio.com", claveIdempotencia: "dnx-vendedor:h1:REENVIO:e1" }),
      { enviar, env: ENV, traerMessageId: sinMessageId },
    );
    expect(llamadas[0]!.mensaje.headers?.["List-Unsubscribe"]).toBeUndefined();
    expect(llamadas[0]!.mensaje.replyTo).toBe("ana@estudio.com");
  });

  it("el enlace lleva dnxv y nunca ref", () => {
    const url = C.enlaceSeguimiento("/clubes", "tok");
    expect(url).toBe("https://www.compramelafoto.com/clubes?dnxv=tok");
    expect(url).not.toMatch(/[?&]ref=/);
  });

  it("una dirección completa permitida (Muestras) no se pega a CLF", () => {
    expect(C.enlaceSeguimiento("https://muestrasfotograficas.com", "tok")).toBe("https://muestrasfotograficas.com?dnxv=tok");
  });

  it("en el HTML la línea de WhatsApp es un botón y los demás enlaces siguen clicables", () => {
    const html = C.htmlDeTexto(`Mirá https://a/x?dnxv=t.\n\n${C.pieDeCorreo("https://baja")}`);
    expect(html).toContain('<a href="https://wa.me/5493413748324" style="');
    expect(html).toContain(">Escribime por WhatsApp</a>");
    expect(html).not.toContain("WhatsApp: https://wa.me");
    expect(html).toContain('<a href="https://a/x?dnxv=t">https://a/x?dnxv=t</a>.');
    expect(html).toContain('<a href="https://baja">https://baja</a>');
  });

  it("el pie identifica a Daniel y ofrece la baja", () => {
    expect(C.pieDeCorreo("https://fotoffice.com/api/correo/baja-dnx?t=x")).toBe(
      "—\nDaniel Cuart\nCompraMeLaFoto · compramelafoto.com\nTel.: 341 374-8324\nWhatsApp: https://wa.me/5493413748324\n\nTe escribo porque tu contacto está publicado como dato comercial. Si no querés que te escriba más, respondé «baja» o entrá acá: https://fotoffice.com/api/correo/baja-dnx?t=x",
    );
    const texto = C.armarTexto("Mirá {{ENLACE}} y el curso {{CURSO}}.", { ENLACE: "https://a/x?dnxv=t", CURSO: "https://a/c?dnxv=t" }, "https://baja");
    expect(texto).toBe(`Mirá https://a/x?dnxv=t y el curso https://a/c?dnxv=t.\n\n${C.pieDeCorreo("https://baja")}`);
  });

  it("el html es el texto escapado con los enlaces clicables", () => {
    const html = C.htmlDeTexto("Hola <Ana> & cía.\nMirá https://www.compramelafoto.com/clubes?dnxv=t&x=1.");
    expect(html).toBe(
      '<div style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px">Hola &lt;Ana&gt; &amp; cía.\nMirá <a href="https://www.compramelafoto.com/clubes?dnxv=t&amp;x=1">https://www.compramelafoto.com/clubes?dnxv=t&amp;x=1</a>.</div>',
    );
  });

  it("la baja del Vendedor firma con su propio ámbito", () => {
    const url = C.urlBajaVendedor("Ana@Estudio.com")!;
    const t = new URL(url).searchParams.get("t");
    expect(url.startsWith("https://fotoffice.com/api/correo/baja-dnx?t=")).toBe(true);
    expect(verifyUnsubscribeToken(t, "secreto-de-prueba")).toEqual({ workspaceId: C.AMBITO_BAJA_VENDEDOR, email: "ana@estudio.com" });
  });

  it("sin dirección de baja no sale", async () => {
    vi.stubEnv("FOTOFFICE_MAILING_SECRET", "");
    vi.stubEnv("FOTOFFICE_CRON_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    const r = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(r).toMatchObject({ ok: false, reintentable: false });
    expect(llamadas).toHaveLength(0);
  });

  it("el recordatorio va en el mismo hilo", async () => {
    await C.enviarCorreoVendedor(
      entrada({ paso: "RECORDATORIO", claveIdempotencia: "dnx-vendedor:h1:RECORDATORIO", enHilo: { messageId: "<m1@resend.dev>", referencias: ["m0@x"] } }),
      { enviar, env: ENV, traerMessageId: sinMessageId },
    );
    const m = llamadas[0]!.mensaje;
    expect(m.headers?.["In-Reply-To"]).toBe("<m1@resend.dev>");
    expect(m.headers?.References).toBe("<m0@x> <m1@resend.dev>");
    expect(m.subject).toBe("Re: Una idea para tus fotos");

    llamadas = [];
    resultado = { status: "SENT", providerId: "re_2" };
    await C.enviarCorreoVendedor(
      entrada({ asunto: "RE: Hola", paso: "RESPUESTA", claveIdempotencia: "dnx-vendedor:h1:RESPUESTA:e1", enHilo: { messageId: "<m2@x>", referencias: [] } }),
      { enviar, env: ENV, traerMessageId: sinMessageId },
    );
    expect(llamadas[0]!.mensaje.subject).toBe("RE: Hola");
  });

  it("guarda el correo y el evento CORREO_ENVIADO con su correoId", async () => {
    const r = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: sinMessageId });
    if (!r.ok) throw new Error("debía salir");
    const [correo] = B.datos.dnxVendedorCorreo;
    expect(correo).toMatchObject({
      id: r.correoId, direccion: "SALIDA", paso: "PRIMERO", resendId: "re_1", hiloId: "h1", contactoId: "c1",
      de: "Daniel Cuart <daniel@compramelafoto.com>", para: "ana@estudio.com", asunto: "Una idea para tus fotos", texto: "Hola Ana", messageId: null,
    });
    const [evento] = B.datos.dnxContactoEvento;
    expect(evento).toMatchObject({
      contactoId: "c1", tipo: "CORREO_ENVIADO", autor: "VENDEDOR",
      datos: { correoId: r.correoId, paso: "PRIMERO", asunto: "Una idea para tus fotos", texto: "Hola Ana" },
    });
    expect(correo!.eventoId).toBe(evento!.id);
  });

  it("sin contacto guarda el correo pero no el evento", async () => {
    const r = await C.enviarCorreoVendedor(entrada({ contactoId: null, hiloId: null, paso: "REENVIO", claveIdempotencia: "k" }), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(r.ok).toBe(true);
    expect(B.datos.dnxVendedorCorreo).toHaveLength(1);
    expect(B.datos.dnxContactoEvento).toHaveLength(0);
  });

  it("dos llamadas con la misma clave no duplican el correo ni el evento", async () => {
    const a = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: sinMessageId });
    const b = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(a).toEqual(b);
    expect(B.datos.dnxVendedorCorreo).toHaveLength(1);
    expect(B.datos.dnxContactoEvento).toHaveLength(1);
    // El primero ya estaba guardado: el segundo ni llama a Resend.
    expect(llamadas).toHaveLength(1);
  });

  it("un reintento tras un guardado fallido usa la misma clave y Resend devuelve el mismo envío", async () => {
    const original = B.tablas.dnxVendedorCorreo.create;
    B.tablas.dnxVendedorCorreo.create = async () => {
      throw new Error("base caída");
    };
    const a = await C.enviarCorreoVendedor(entrada({ paso: "RESPUESTA", claveIdempotencia: "dnx-vendedor:h1:RESPUESTA:e1" }), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(a).toMatchObject({ ok: false, reintentable: true });
    B.tablas.dnxVendedorCorreo.create = original;
    const b = await C.enviarCorreoVendedor(entrada({ paso: "RESPUESTA", claveIdempotencia: "dnx-vendedor:h1:RESPUESTA:e1" }), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(b.ok).toBe(true);
    expect(llamadas.map((l) => l.mensaje.idempotencyKey)).toEqual(["dnx-vendedor:h1:RESPUESTA:e1", "dnx-vendedor:h1:RESPUESTA:e1"]);
    expect(B.datos.dnxVendedorCorreo).toHaveLength(1);
    expect(B.datos.dnxContactoEvento).toHaveLength(1);
  });

  it("si Resend devuelve un id ya guardado, no se duplica", async () => {
    B.agregar("dnxVendedorCorreo", { direccion: "SALIDA", paso: "RESPUESTA", resendId: "re_1", de: "x", para: "y", asunto: "a", texto: "t" });
    const r = await C.enviarCorreoVendedor(entrada({ paso: "RESPUESTA", claveIdempotencia: "dnx-vendedor:h1:RESPUESTA:e1" }), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(r).toEqual({ ok: true, correoId: B.datos.dnxVendedorCorreo[0]!.id });
    expect(B.datos.dnxVendedorCorreo).toHaveLength(1);
    expect(B.datos.dnxContactoEvento).toHaveLength(0);
  });

  it("un rechazo de Resend no guarda nada y es reintentable", async () => {
    resultado = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    const r = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(r).toEqual({ ok: false, motivo: "HTTP 500", reintentable: true });
    expect(B.datos.dnxVendedorCorreo).toHaveLength(0);
    expect(B.datos.dnxContactoEvento).toHaveLength(0);

    resultado = { status: "CONFIGURATION_ERROR", detail: "Faltan variables" };
    const c = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: sinMessageId });
    expect(c).toMatchObject({ ok: false, reintentable: false });
  });

  it("completa el messageId cuando Resend lo tiene", async () => {
    const r = await C.enviarCorreoVendedor(entrada(), { enviar, env: ENV, traerMessageId: async (id) => (id === "re_1" ? "<abc@resend.dev>" : null) });
    if (!r.ok) throw new Error("debía salir");
    expect(B.datos.dnxVendedorCorreo[0]!.messageId).toBe("<abc@resend.dev>");

    // Y si no lo tenía todavía, la pasada de completarMessageIds lo trae (sólo las de las últimas 24 h).
    const ahora = new Date("2026-11-20T15:00:00.000Z");
    B.vaciar();
    B.agregar("dnxVendedorCorreo", { direccion: "SALIDA", resendId: "re_a", de: "x", para: "y", asunto: "a", texto: "t", creadoEn: new Date("2026-11-20T10:00:00.000Z") });
    B.agregar("dnxVendedorCorreo", { direccion: "SALIDA", resendId: "re_b", de: "x", para: "y", asunto: "a", texto: "t", creadoEn: new Date("2026-11-18T10:00:00.000Z") });
    B.agregar("dnxVendedorCorreo", { direccion: "ENTRADA", resendId: "re_c", de: "x", para: "y", asunto: "a", texto: "t", creadoEn: new Date("2026-11-20T10:00:00.000Z") });
    const pedidos: string[] = [];
    const n = await C.completarMessageIds({ ahora, traerMessageId: async (id) => (pedidos.push(id), `<${id}@resend.dev>`) });
    expect(n).toBe(1);
    expect(pedidos).toEqual(["re_a"]);
    expect(B.datos.dnxVendedorCorreo[0]!.messageId).toBe("<re_a@resend.dev>");
  });

  it("traerMessageIdResend normaliza con <…> y devuelve null si falla", async () => {
    const pedidos: { url: string; auth: string | null }[] = [];
    const fetchFalso = (async (url: string, init?: RequestInit) => {
      pedidos.push({ url, auth: new Headers(init?.headers).get("Authorization") });
      return new Response(JSON.stringify({ id: "re_1", message_id: "abc@resend.dev" }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await C.traerMessageIdResend("re_1", { fetch: fetchFalso, clave: "k" })).toBe("<abc@resend.dev>");
    expect(pedidos[0]).toEqual({ url: "https://api.resend.com/emails/re_1", auth: "Bearer k" });

    const caido = (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch;
    expect(await C.traerMessageIdResend("re_1", { fetch: caido, clave: "k" })).toBeNull();
    const roto = (async () => {
      throw new Error("red");
    }) as unknown as typeof fetch;
    expect(await C.traerMessageIdResend("re_1", { fetch: roto, clave: "k" })).toBeNull();
    expect(await C.traerMessageIdResend("re_1", { fetch: fetchFalso, clave: null })).toBeNull();
  });
});
