import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail, SendOutcome } from "@/lib/communications/send-email";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({ real: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "Estudio DNX",
    signature: { html: "<table>FIRMA-HTML</table>", text: "FIRMA-TEXTO" },
    contact: { email: "hola@estudio.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));
// Red de seguridad: si algo llamara al transporte real, la prueba lo detecta (y no sale nada).
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.real }));

const E = await import("./envio");
const M = E.MENSAJES_ENVIO;

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", userName: "Ana", userEmail: "ana@estudio.test", role: "STAFF" };
const AHORA = new Date("2026-10-01T15:00:00.000Z"); // 12:00 en Buenos Aires
const EMAIL_PERSONA = "lucia@persona.test";
const TEL_PERSONA = "+54 341 555-0000";

const mensajes = () => B.datos.fotofficeMessage;

function enviador(r: SendOutcome = { status: "SENT", providerId: "re_id_1" }) {
  return vi.fn(async (_m: OutboundEmail) => r);
}

function cliente(datos: Record<string, unknown> = {}) {
  return B.agregar("client", {
    id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Lucía", lastName: "Gómez", email: EMAIL_PERSONA, phone: TEL_PERSONA,
    memberId: null, ...datos,
  });
}

function plantilla(datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficeMessageTemplate", {
    workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", name: "Gracias", subject: "Gracias [nombre]",
    body: "Hola [nombre], gracias.\n\n[firma]", ...datos,
  }).id as string;
}

function enviados(n: number, datos: Record<string, unknown> = {}) {
  for (let i = 0; i < n; i++) {
    B.agregar("fotofficeMessage", {
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "otro", toAddress: "x", body: "x", status: "SENT",
      createdAt: new Date("2026-10-01T10:00:00.000Z"), ...datos,
    });
  }
}

const BASE = { entityType: "CLIENTE" as const, entityId: "c1", asunto: "Hola Lucía", cuerpo: "Gracias por todo." };

beforeEach(() => {
  B.vaciar();
  H.real.mockReset();
  cliente();
});
afterEach(() => {
  expect(H.real).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe("prepararMensaje", () => {
  it("completa con los datos y deja [firma] escrita en el cuerpo; no escribe", async () => {
    const id = plantilla({ body: "Hola [nombre] [apellido][campo:colegio].\n\n[firma]" });
    B.agregar("fotofficeCustomField", { id: "f1", workspaceId: "ws-1", entityType: "CLIENTE", key: "colegio", name: "Colegio", type: "TEXTO" });
    const r = await E.prepararMensaje(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: id });
    expect(r).toEqual({
      ok: true, asunto: "Gracias Lucía", cuerpo: "Hola Lucía Gómez.\n\n[firma]", vacias: ["campo:colegio"], pendientes: false,
      destino: { email: EMAIL_PERSONA, telefono: TEL_PERSONA },
    });
    expect(mensajes()).toHaveLength(0);
  });

  it("sin plantilla devuelve textos vacíos; marca los marcadores en mayúsculas", async () => {
    expect(await E.prepararMensaje(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c1" })).toMatchObject({ ok: true, asunto: "", cuerpo: "" });
    const id = plantilla({ body: "Te paso el enlace: [PEGÁ ACÁ EL ENLACE]" });
    expect(await E.prepararMensaje(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: id })).toMatchObject({ pendientes: true });
  });

  it("plantilla de otro workspace, archivada, de otro canal, de otra ficha o automática: rechazada", async () => {
    const ajena = plantilla({ workspaceId: "ws-2" });
    const archivada = plantilla({ archivedAt: new Date() });
    const wsp = plantilla({ channel: "WHATSAPP", subject: null });
    const consulta = plantilla({ entityType: "CONSULTA" });
    const auto = plantilla({ entityType: "CONSULTA", systemKey: "CONSULTA_AUTORESPUESTA" });
    for (const templateId of [ajena, archivada, wsp, consulta, auto, "inexistente"]) {
      expect(await E.prepararMensaje(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId })).toEqual({
        ok: false, error: M.plantillaNoEncontrada,
      });
    }
    const general = plantilla({ entityType: "GENERAL", subject: "Hola", body: "Hola [nombre]" });
    expect(await E.prepararMensaje(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: general })).toMatchObject({ ok: true });
  });

  it("registro de otro workspace: no encontrado", async () => {
    cliente({ id: "c2", workspaceId: "ws-2" });
    expect(await E.prepararMensaje(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c2" })).toEqual({ ok: false, error: M.noEncontrado });
  });
});

describe("enviarCorreo", () => {
  it("envía sólo a la persona, con el nombre de la organización y responder-a, y registra SENT", async () => {
    const id = plantilla();
    const enviar = enviador();
    const r = await E.enviarCorreo(CTX, { ...BASE, templateId: id, cuerpo: "Hola Lucía, <b>gracias</b>.\n\n[firma]" }, { enviar, ahora: () => AHORA });
    expect(r).toMatchObject({ ok: true });
    expect(enviar).toHaveBeenCalledTimes(1);
    const m = enviar.mock.calls[0]![0];
    expect(m).toMatchObject({ to: EMAIL_PERSONA, subject: "Hola Lucía", fromName: "Estudio DNX", replyTo: "hola@estudio.test" });
    expect(m.html).toContain("&lt;b&gt;gracias&lt;/b&gt;");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: id, toAddress: EMAIL_PERSONA,
      subject: "Hola Lucía", status: "SENT", providerId: "re_id_1", errorCode: null, automatic: false, actorUserId: 7, actorLabel: "Ana",
      body: "Hola Lucía, <b>gracias</b>.\n\n[firma]",
    });
  });

  it("la firma va una sola vez: donde está [firma], o al final si falta", async () => {
    const enviar = enviador();
    await E.enviarCorreo(CTX, { ...BASE, cuerpo: "Arriba\n\n[firma]\n\nAbajo" }, { enviar, ahora: () => AHORA });
    await E.enviarCorreo(CTX, { ...BASE, cuerpo: "Sin firma escrita" }, { enviar, ahora: () => AHORA });
    for (const [m] of enviar.mock.calls) {
      expect(m.html.split("FIRMA-HTML")).toHaveLength(2);
      expect(m.text.split("FIRMA-TEXTO")).toHaveLength(2);
      expect(m.html).not.toContain("[firma]");
    }
    expect(enviar.mock.calls[0]![0].html.indexOf("FIRMA-HTML")).toBeLessThan(enviar.mock.calls[0]![0].html.indexOf("Abajo"));
    expect(enviar.mock.calls[1]![0].text.endsWith("FIRMA-TEXTO")).toBe(true);
  });

  it("un marcador de firma falsificado (U+E000) no inyecta nada", async () => {
    const enviar = enviador();
    await E.enviarCorreo(CTX, { ...BASE, cuerpo: "Hola \uE000firma\uE000 x" }, { enviar, ahora: () => AHORA });
    expect(enviar.mock.calls[0]![0].html.split("FIRMA-HTML")).toHaveLength(2);
  });

  it("persona sin correo: error claro, sin enviar ni registrar", async () => {
    cliente({ id: "c2", email: null });
    cliente({ id: "c3", email: "no-es-un-correo" });
    const enviar = enviador();
    for (const entityId of ["c2", "c3"]) {
      expect(await E.enviarCorreo(CTX, { ...BASE, entityId }, { enviar, ahora: () => AHORA })).toEqual({ ok: false, error: M.sinCorreo });
    }
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it.each([
    [199, true],
    [200, false],
    [201, false],
  ])("tope diario: con %i enviados hoy, ¿envía? %s", async (n, envia) => {
    enviados(n);
    const enviar = enviador();
    const r = await E.enviarCorreo(CTX, BASE, { enviar, ahora: () => AHORA });
    if (envia) {
      expect(r.ok).toBe(true);
      expect(mensajes().filter((m) => m.entityId === "c1")).toHaveLength(1);
    } else {
      expect(r).toEqual({ ok: false, error: M.tope });
      expect(enviar).not.toHaveBeenCalled();
      expect(mensajes()).toHaveLength(n);
    }
  });

  it("el tope cuenta sólo los SENT de correo de hoy (Buenos Aires) y del workspace", async () => {
    enviados(150);
    enviados(60, { status: "FAILED" });
    enviados(60, { channel: "WHATSAPP", status: "OPENED_WHATSAPP" });
    enviados(60, { workspaceId: "ws-2" });
    // Ayer a las 23:59 de Buenos Aires (02:59 UTC de hoy) no cuenta; hoy 00:00 AR sí.
    enviados(60, { createdAt: new Date("2026-10-01T02:59:00.000Z") });
    enviados(49, { createdAt: new Date("2026-10-01T03:00:00.000Z") });
    expect(await E.correosEnviadosHoy("ws-1", AHORA)).toBe(199);
    const enviar = enviador();
    expect((await E.enviarCorreo(CTX, BASE, { enviar, ahora: () => AHORA })).ok).toBe(true);
    expect((await E.enviarCorreo(CTX, BASE, { enviar, ahora: () => AHORA }))).toEqual({ ok: false, error: M.tope });
  });

  it("los automáticos tienen su propio tope: no consumen los 200 manuales", async () => {
    enviados(199);
    enviados(50, { automatic: true });
    expect(await E.correosEnviadosHoy("ws-1", AHORA)).toBe(199);
    expect(await E.correosEnviadosHoy("ws-1", AHORA, true)).toBe(50);
    const enviar = enviador();
    expect((await E.enviarCorreo(CTX, BASE, { enviar, ahora: () => AHORA })).ok).toBe(true);
    expect(await E.enviarCorreo(CTX, BASE, { enviar, ahora: () => AHORA })).toEqual({ ok: false, error: M.tope });
  });

  it("falla del proveedor: registra FAILED con código y sin datos personales en los logs", async () => {
    const consola = [vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}), vi.spyOn(console, "info").mockImplementation(() => {})];
    const enviar = enviador({ status: "PROVIDER_REJECTED", detail: `HTTP 422 · validation_error · Invalid to: ${EMAIL_PERSONA}` });
    const cuerpo = "Texto privado del mensaje";
    const r = await E.enviarCorreo(CTX, { ...BASE, cuerpo }, { enviar, ahora: () => AHORA });
    expect(r).toEqual({ ok: false, error: M.falloProveedor, registrado: true });
    expect(mensajes()[0]).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_REJECTED:422:validation_error", providerId: null });
    const logs = JSON.stringify(consola.flatMap((s) => s.mock.calls));
    expect(logs).not.toContain(EMAIL_PERSONA);
    expect(logs).not.toContain(cuerpo);
    expect(logs).not.toContain("Lucía");
    expect(consola[0]!).toHaveBeenCalled();
  });

  it("sin configuración: FAILED con CONFIGURATION_ERROR; un FAILED no cuenta para el tope", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    enviados(199);
    const r = await E.enviarCorreo(CTX, BASE, { enviar: enviador({ status: "CONFIGURATION_ERROR", detail: "Faltan" }), ahora: () => AHORA });
    expect(r).toEqual({ ok: false, error: M.falloConfiguracion, registrado: true });
    expect(mensajes().at(-1)).toMatchObject({ status: "FAILED", errorCode: "CONFIGURATION_ERROR" });
    expect((await E.enviarCorreo(CTX, BASE, { enviar: enviador(), ahora: () => AHORA })).ok).toBe(true);
  });

  it("frena marcadores en mayúsculas en el asunto o el cuerpo", async () => {
    const enviar = enviador();
    for (const d of [{ cuerpo: "Mirá: [PEGÁ ACÁ EL ENLACE]" }, { asunto: "Propuesta [NOMBRE DEL EVENTO]" }]) {
      expect(await E.enviarCorreo(CTX, { ...BASE, ...d }, { enviar, ahora: () => AHORA })).toEqual({ ok: false, error: M.marcadorSinCompletar });
    }
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it("frena una variable que quedó sin completar (también [firma] en el asunto)", async () => {
    const enviar = enviador();
    expect(await E.enviarCorreo(CTX, { ...BASE, cuerpo: "Hola [nombre]" }, { enviar, ahora: () => AHORA })).toEqual({
      ok: false, error: "Quedó una variable sin completar: [nombre]",
    });
    expect(await E.enviarCorreo(CTX, { ...BASE, cuerpo: "[si:consulta_lugar]En x[/si]" }, { enviar, ahora: () => AHORA })).toEqual({
      ok: false, error: "Quedó una variable sin completar: [si:consulta_lugar]",
    });
    expect(await E.enviarCorreo(CTX, { ...BASE, asunto: "Hola [firma]" }, { enviar, ahora: () => AHORA })).toEqual({
      ok: false, error: "Quedó una variable sin completar: [firma]",
    });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("plantilla de otro workspace o archivada: rechazada sin enviar", async () => {
    const enviar = enviador();
    for (const templateId of [plantilla({ workspaceId: "ws-2" }), plantilla({ archivedAt: new Date() })]) {
      expect(await E.enviarCorreo(CTX, { ...BASE, templateId }, { enviar, ahora: () => AHORA })).toEqual({ ok: false, error: M.plantillaNoEncontrada });
    }
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it("sin `operar` no envía; el automático no lo necesita pero exige la plantilla automática", async () => {
    const enviar = enviador();
    expect(await E.enviarCorreo({ ...CTX, role: "COLLABORATOR" }, BASE, { enviar })).toEqual({ ok: false, error: M.sinPermiso });
    B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Mara", email: "mara@x.test", eventType: "BODA" });
    const auto = plantilla({ entityType: "CONSULTA", systemKey: "CONSULTA_AUTORESPUESTA", enabled: true });
    const comun = plantilla({ entityType: "CONSULTA" });
    const sinUsuario = { workspaceId: "ws-1", userId: null, userLabel: null, role: null };
    const d = { entityType: "CONSULTA" as const, entityId: "l1", asunto: "Recibimos tu consulta", cuerpo: "Gracias", automatico: true };
    expect(await E.enviarCorreo(sinUsuario, { ...d, templateId: comun }, { enviar, ahora: () => AHORA })).toEqual({ ok: false, error: M.plantillaNoEncontrada });
    expect((await E.enviarCorreo(sinUsuario, { ...d, templateId: auto }, { enviar, ahora: () => AHORA })).ok).toBe(true);
    expect(mensajes()[0]).toMatchObject({ automatic: true, actorLabel: "Automático", templateId: auto });
  });
});

describe("arreglos de revisión", () => {
  it("un automático sin plantilla, con la automática apagada o de otro workspace: no se envía", async () => {
    B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Mara", email: "mara@x.test", eventType: "BODA" });
    const apagada = plantilla({ entityType: "CONSULTA", systemKey: "CONSULTA_AUTORESPUESTA", enabled: false });
    const ajena = plantilla({ workspaceId: "ws-2", entityType: "CONSULTA", systemKey: "CONSULTA_AUTORESPUESTA", enabled: true });
    const sinUsuario = { workspaceId: "ws-1", userId: null, userLabel: null, role: null };
    const d = { entityType: "CONSULTA" as const, entityId: "l1", asunto: "Hola", cuerpo: "Gracias", automatico: true };
    const enviar = enviador();
    for (const templateId of [undefined, null, "", apagada, ajena]) {
      expect(await E.enviarCorreo(sinUsuario, { ...d, templateId }, { enviar, ahora: () => AHORA })).toEqual({
        ok: false, error: M.plantillaNoEncontrada,
      });
    }
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it("los corchetes de un dato se vuelven paréntesis y no frenan el envío", async () => {
    cliente({ id: "c2", firstName: "[Estudio]", lastName: "[NOMBRE]" });
    const id = plantilla({ subject: "Hola [nombre_completo]", body: "Hola [nombre_completo]" });
    const r = await E.prepararMensaje(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c2", templateId: id });
    expect(r).toMatchObject({ ok: true, asunto: "Hola (Estudio) (NOMBRE)", cuerpo: "Hola (Estudio) (NOMBRE)", pendientes: false });
    if (!r.ok) return;
    const enviar = enviador();
    expect((await E.enviarCorreo(CTX, { ...BASE, entityId: "c2", templateId: id, asunto: r.asunto, cuerpo: r.cuerpo }, { enviar, ahora: () => AHORA })).ok).toBe(true);
  });

  it("el cuerpo registrado no guarda el carácter del marcador", async () => {
    await E.enviarCorreo(CTX, { ...BASE, cuerpo: "Hola \uE000firma\uE000 x" }, { enviar: enviador(), ahora: () => AHORA });
    expect(mensajes()[0]!.body).toBe("Hola firma x");
  });

  it("si no se puede registrar el WhatsApp, devuelve un error en vez de lanzar", async () => {
    const original = B.tablas.fotofficeMessage.create;
    B.tablas.fotofficeMessage.create = async () => {
      throw Object.assign(new Error("caída"), { code: "P1001" });
    };
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await E.abrirWhatsapp(CTX, { entityType: "CLIENTE", entityId: "c1", cuerpo: "Hola privado" })).toEqual({
        ok: false, error: M.falloRegistro,
      });
      const logs = JSON.stringify(consola.mock.calls);
      expect(logs).not.toContain("Hola privado");
      expect(logs).not.toContain("5493415550000");
    } finally {
      B.tablas.fotofficeMessage.create = original;
    }
  });
});

describe("abrirWhatsapp", () => {
  it("normaliza el número, arma la URL con el texto y registra OPENED_WHATSAPP", async () => {
    const id = plantilla({ channel: "WHATSAPP", subject: null, body: "Hola" });
    const r = await E.abrirWhatsapp(CTX, { entityType: "CLIENTE", entityId: "c1", templateId: id, cuerpo: "Hola Lucía\n\n¿Coordinamos?" });
    expect(r).toMatchObject({ ok: true, url: `https://wa.me/5493415550000?text=${encodeURIComponent("Hola Lucía\n\n¿Coordinamos?")}` });
    expect(mensajes()[0]).toMatchObject({
      channel: "WHATSAPP", status: "OPENED_WHATSAPP", toAddress: "5493415550000", templateId: id, subject: null,
      body: "Hola Lucía\n\n¿Coordinamos?", actorUserId: 7,
    });
  });

  it("la firma sólo si se pide con [firma], en texto", async () => {
    const r = await E.abrirWhatsapp(CTX, { entityType: "CLIENTE", entityId: "c1", cuerpo: "Hola\n\n[firma]" });
    expect(r.ok && decodeURIComponent(r.url)).toContain("FIRMA-TEXTO");
    const s = await E.abrirWhatsapp(CTX, { entityType: "CLIENTE", entityId: "c1", cuerpo: "Hola" });
    expect(s.ok && decodeURIComponent(s.url)).not.toContain("FIRMA");
  });

  it("sin teléfono válido: error, sin registrar", async () => {
    cliente({ id: "c2", phone: null });
    cliente({ id: "c3", phone: "3415550000" });
    for (const entityId of ["c2", "c3"]) {
      expect(await E.abrirWhatsapp(CTX, { entityType: "CLIENTE", entityId, cuerpo: "Hola" })).toEqual({ ok: false, error: M.sinWhatsapp });
    }
    expect(mensajes()).toHaveLength(0);
  });

  it("frena marcadores, variables sobrantes, plantillas ajenas o de correo, y sin `operar`", async () => {
    const d = { entityType: "CLIENTE" as const, entityId: "c1" };
    expect(await E.abrirWhatsapp(CTX, { ...d, cuerpo: "[COMPLETÁ]" })).toEqual({ ok: false, error: M.marcadorSinCompletar });
    expect(await E.abrirWhatsapp(CTX, { ...d, cuerpo: "Hola [nombre]" })).toEqual({ ok: false, error: "Quedó una variable sin completar: [nombre]" });
    expect(await E.abrirWhatsapp(CTX, { ...d, cuerpo: "Hola", templateId: plantilla() })).toEqual({ ok: false, error: M.plantillaNoEncontrada });
    expect(await E.abrirWhatsapp(CTX, { ...d, cuerpo: "Hola", templateId: plantilla({ channel: "WHATSAPP", workspaceId: "ws-2" }) })).toEqual({
      ok: false, error: M.plantillaNoEncontrada,
    });
    expect(await E.abrirWhatsapp({ ...CTX, role: null }, { ...d, cuerpo: "Hola" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(mensajes()).toHaveLength(0);
  });
});
