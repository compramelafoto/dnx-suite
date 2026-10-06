import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail } from "@/lib/communications/send-email";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

// Nunca sale un correo real: el transporte está reemplazado y además cada prueba inyecta el suyo.
const H = vi.hoisted(() => ({
  transporte: vi.fn(async (_m: unknown) => ({ status: "SENT", providerId: "no-deberia" })),
  nivel: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.transporte }));
vi.mock("@/lib/vocabulario/load", () => ({
  loadPersonVocabulary: async () => ({ singular: "socio", plural: "socios", Singular: "Socio", Plural: "Socios" }),
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "Estudio DNX",
    signature: { html: "<table>FIRMA</table>", text: "FIRMA" },
    contact: { email: "hola@estudio.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async () => true }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: async () => ({ movido: true }) }));

const V = await import("./aviso");
const { TOPE_AUTOMATICOS_DIA, TOPE_AVISOS_EQUIPO_DIA, TOPE_CORREOS_DIA } = await import("@/lib/plantillas/constantes");

// 15:00 UTC = 12:00 en Buenos Aires del 1/10: la tarea vence el 1/10 a las 23:59 de allá.
const AHORA = new Date("2026-10-01T15:00:00.000Z");
const VENCE = new Date("2026-10-02T02:59:00.000Z");

const enviar = vi.fn(async (_m: OutboundEmail) => ({ status: "SENT" as const, providerId: "re_1" }));
const deps = { enviar, ahora: () => AHORA, tieneGestionar: (userId: number) => H.nivel(userId) };
const correo = (i = 0) => enviar.mock.calls[i]![0];
const tareas = () => B.datos.fotofficeTask;

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  enviar.mockReset();
  enviar.mockResolvedValue({ status: "SENT", providerId: "re_1" });
  H.nivel.mockReset();
  H.nivel.mockResolvedValue(true);
  H.transporte.mockClear();
  B.agregar("user", { id: 1, email: "duena@estudio.test", name: "Dueña" });
  B.agregar("user", { id: 5, email: "vendedor@estudio.test", name: "Vendedor" });
  B.agregar("workspaceMembership", { userId: 1, workspaceId: "ws-1", role: "WORKSPACE_OWNER", createdAt: new Date("2025-01-01") });
  B.agregar("workspaceMembership", { userId: 5, workspaceId: "ws-1", role: "STAFF", createdAt: new Date("2025-02-01") });
  B.agregar("serviceSalesLead", {
    id: "l1", workspaceId: "ws-1", name: "Laura Pérez", email: "laura@persona.test", phone: "3415550000", eventType: "BODA",
    message: "Queremos fotos",
  });
  B.agregar("fotofficeJourney", { id: "j1", workspaceId: "ws-1", subjectType: "CAPTACION", subjectId: "l1", kind: "VENTA", circuitId: "c" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  // Nunca se loguean datos de la persona.
  const log = JSON.stringify(errores.mock.calls);
  expect(log).not.toContain("laura");
  expect(log).not.toContain("vendedor@");
  errores.mockRestore();
  expect(H.transporte).not.toHaveBeenCalled();
});

describe("venceHoyALas2359", () => {
  it("hoy a las 23:59 de Buenos Aires, también de madrugada en UTC", () => {
    expect(V.venceHoyALas2359(AHORA)).toEqual(VENCE);
    // 01:00 UTC del 2/10 todavía es el 1/10 en Buenos Aires.
    expect(V.venceHoyALas2359(new Date("2026-10-02T01:00:00.000Z"))).toEqual(VENCE);
  });
});

describe("avisarConsultaNueva", () => {
  it("sin responsable en ajustes: correo y tarea al dueño, con la plantilla del sistema", async () => {
    const r = await V.avisarConsultaNueva("ws-1", "l1", {}, deps);
    expect(r).toEqual({ destinatarioUserId: 1, correo: "ENVIADO", tarea: "CREADA" });
    expect(tareas()).toHaveLength(1);
    expect(tareas()[0]).toMatchObject({
      workspaceId: "ws-1", journeyId: "j1", subjectType: "CAPTACION", subjectId: "l1", title: "Responder consulta",
      assigneeUserId: 1, dueAt: VENCE, createdByUserId: null,
    });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(correo().to).toBe("duena@estudio.test");
    expect(correo().subject).toBe("Nueva consulta de Laura Pérez");
    expect(correo().text).toContain("Hola, Dueña:");
    expect(correo().text).toContain("Correo: laura@persona.test");
    expect(correo().text).toContain("Mensaje: Queremos fotos");
    // Remitente de FOTOFFICE: ni el nombre de la organización ni su casilla.
    expect(correo().fromName).toBeUndefined();
    expect(correo().replyTo).toBeUndefined();
    // La plantilla se sembró una vez, encendida.
    expect(B.datos.fotofficeMessageTemplate.filter((p) => p.systemKey === "CONSULTA_AVISO_EQUIPO")).toHaveLength(1);
  });

  it("con responsable en ajustes (del equipo y con Gestionar): a él", async () => {
    B.agregar("fotofficeConsultaAjustes", { workspaceId: "ws-1", defaultOwnerUserId: 5 });
    const r = await V.avisarConsultaNueva("ws-1", "l1", {}, deps);
    expect(r.destinatarioUserId).toBe(5);
    expect(correo().to).toBe("vendedor@estudio.test");
    expect(tareas()[0]).toMatchObject({ assigneeUserId: 5 });
  });

  it("el responsable elegido en el alta gana sobre el de ajustes", async () => {
    B.agregar("fotofficeConsultaAjustes", { workspaceId: "ws-1", defaultOwnerUserId: 1 });
    expect((await V.avisarConsultaNueva("ws-1", "l1", { responsableUserId: 5 }, deps)).destinatarioUserId).toBe(5);
  });

  it("si el responsable de ajustes perdió Gestionar o ya no es del equipo: al dueño", async () => {
    B.agregar("fotofficeConsultaAjustes", { workspaceId: "ws-1", defaultOwnerUserId: 5 });
    H.nivel.mockImplementation(async (userId: unknown) => userId !== 5);
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).destinatarioUserId).toBe(1);
    B.datos.fotofficeConsultaAjustes[0]!.defaultOwnerUserId = 99;
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).destinatarioUserId).toBe(1);
  });

  it("sin nadie (ni dueño): la tarea queda sin asignar y no hay correo", async () => {
    B.datos.workspaceMembership = [];
    expect(await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).toEqual({
      destinatarioUserId: null, correo: "SIN_DESTINATARIO", tarea: "CREADA",
    });
    expect(tareas()[0]).toMatchObject({ assigneeUserId: null });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("el dueño de otro workspace nunca recibe", async () => {
    B.datos.workspaceMembership = [];
    B.agregar("workspaceMembership", { userId: 1, workspaceId: "ws-2", role: "WORKSPACE_OWNER" });
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).destinatarioUserId).toBeNull();
  });

  it("ajustes: sin correo, sin tarea, o sin los dos", async () => {
    B.agregar("fotofficeConsultaAjustes", { workspaceId: "ws-1", notifyEmail: false, createTask: true });
    expect(await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).toMatchObject({ correo: "OMITIDO", tarea: "CREADA" });
    Object.assign(B.datos.fotofficeConsultaAjustes[0]!, { notifyEmail: true, createTask: false });
    expect(await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).toMatchObject({ correo: "ENVIADO", tarea: "OMITIDA" });
    Object.assign(B.datos.fotofficeConsultaAjustes[0]!, { notifyEmail: false, createTask: false });
    expect(await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).toEqual({ destinatarioUserId: null, correo: "OMITIDO", tarea: "OMITIDA" });
    expect(tareas()).toHaveLength(1);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("la plantilla apagada no manda correo; la tarea sale igual", async () => {
    B.agregar("fotofficeMessageTemplate", {
      workspaceId: "ws-1", systemKey: "CONSULTA_AVISO_EQUIPO", channel: "EMAIL", entityType: "CONSULTA", name: "Aviso",
      subject: "x", body: "y", enabled: false,
    });
    expect(await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).toMatchObject({ correo: "APAGADA", tarea: "CREADA" });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("queda registrado (para contarlo), pero no cuenta en los topes ni en la regla de 24 h por dirección", async () => {
    const hoy = new Date(AHORA.getTime() - 60_000);
    const fila = (automatic: boolean, toAddress: string) => ({
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "otra", toAddress, subject: "s", body: "b",
      status: "SENT", automatic, createdAt: hoy,
    });
    for (let i = 0; i < TOPE_CORREOS_DIA; i++) B.agregar("fotofficeMessage", fila(false, "x@y.test"));
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) B.agregar("fotofficeMessage", fila(true, "duena@estudio.test"));
    const antes = B.datos.fotofficeMessage.length;
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).correo).toBe("ENVIADO");
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).correo).toBe("ENVIADO");
    expect(enviar).toHaveBeenCalledTimes(2);
    const avisoId = B.datos.fotofficeMessageTemplate.find((p) => p.systemKey === "CONSULTA_AVISO_EQUIPO")!.id;
    const nuevos = B.datos.fotofficeMessage.slice(antes);
    expect(nuevos).toHaveLength(2);
    expect(nuevos[0]).toMatchObject({
      channel: "EMAIL", automatic: true, status: "SENT", entityType: "CONSULTA", entityId: "l1", templateId: avisoId,
      toAddress: "duena@estudio.test", actorLabel: "Aviso al equipo", providerId: "re_1",
    });
  });

  it("los avisos registrados no cuentan para los topes de la organización ni frenan la respuesta a la persona", async () => {
    await V.avisarConsultaNueva("ws-1", "l1", {}, deps);
    const { correosEnviadosHoy } = await import("@/lib/plantillas/envio");
    expect(await correosEnviadosHoy("ws-1", AHORA)).toBe(0);
    expect(await correosEnviadosHoy("ws-1", AHORA, true)).toBe(0);
    // Si la consulta la mandó alguien del equipo con su propia casilla, la respuesta automática igual sale.
    B.agregar("fotofficeMessageTemplate", {
      workspaceId: "ws-1", systemKey: "CONSULTA_AUTORESPUESTA", channel: "EMAIL", entityType: "CONSULTA", name: "Auto",
      subject: "Recibimos tu consulta", body: "Hola", enabled: true,
    });
    B.datos.serviceSalesLead[0]!.email = "duena@estudio.test";
    const { responderConsultaNueva } = await import("@/lib/plantillas/automaticos");
    expect(await responderConsultaNueva("ws-1", "l1", { enviar, ahora: () => AHORA })).toBe("ENVIADO");
  });

  it(`tope propio: ${TOPE_AVISOS_EQUIPO_DIA} por día de Buenos Aires; pasado, sólo la tarea`, async () => {
    await V.avisarConsultaNueva("ws-1", "l1", {}, deps);
    const avisoId = B.datos.fotofficeMessageTemplate.find((p) => p.systemKey === "CONSULTA_AVISO_EQUIPO")!.id;
    const fila = (createdAt: Date, status = "SENT") => ({
      workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "x", toAddress: "duena@estudio.test", subject: "s",
      body: "b", status, automatic: true, templateId: avisoId, createdAt,
    });
    // Ayer (en Buenos Aires) no cuenta: 02:59 UTC del 1/10 es el 30/9 allá.
    for (let i = 0; i < 50; i++) B.agregar("fotofficeMessage", fila(new Date("2026-10-01T02:59:00.000Z")));
    // Hoy: con el de arriba suman 99, contando los fallidos.
    for (let i = 0; i < TOPE_AVISOS_EQUIPO_DIA - 2; i++) B.agregar("fotofficeMessage", fila(new Date("2026-10-01T03:00:00.000Z"), i % 2 ? "SENT" : "FAILED"));
    enviar.mockClear();
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).correo).toBe("ENVIADO");
    const r = await V.avisarConsultaNueva("ws-1", "l1", {}, deps);
    expect(r).toMatchObject({ correo: "TOPE", tarea: "CREADA" });
    expect(enviar).toHaveBeenCalledTimes(1);
    // Otra organización tiene su propio conteo.
    B.agregar("workspaceMembership", { userId: 1, workspaceId: "ws-2", role: "WORKSPACE_OWNER" });
    B.agregar("serviceSalesLead", { id: "l2", workspaceId: "ws-2", name: "Otra", eventType: "BODA" });
    expect((await V.avisarConsultaNueva("ws-2", "l2", {}, deps)).correo).toBe("ENVIADO");
  });

  it("un aviso que el proveedor rechaza queda registrado como fallido", async () => {
    enviar.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422" } as never);
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).correo).toBe("NO_ENVIADO");
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_REJECTED", providerId: null });
  });

  it("nunca lanza: si la tarea o el correo fallan, sigue con lo otro", async () => {
    const original = B.tablas.fotofficeTask.create;
    B.tablas.fotofficeTask.create = async () => {
      throw Object.assign(new Error("laura caída"), { code: "P1001" });
    };
    expect(await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).toMatchObject({ tarea: "ERROR", correo: "ENVIADO" });
    B.tablas.fotofficeTask.create = original;
    enviar.mockRejectedValue(new Error("Resend caído laura@persona.test"));
    expect(await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).toMatchObject({ tarea: "CREADA", correo: "ERROR" });
    enviar.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422" } as never);
    expect((await V.avisarConsultaNueva("ws-1", "l1", {}, deps)).correo).toBe("NO_ENVIADO");
  });

  it("sin recorrido abierto, la tarea queda colgada de la consulta igual", async () => {
    B.datos.fotofficeJourney = [];
    await V.avisarConsultaNueva("ws-1", "l1", {}, deps);
    expect(tareas()[0]).toMatchObject({ journeyId: null, subjectId: "l1" });
  });
});
