import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

// Los cuatro pasos de después del alta se reemplazan para mirar su orden y su aislamiento; cada
// uno tiene sus propias pruebas (numero.test, eventos.test, aviso.test, automaticos.test).
const H = vi.hoisted(() => ({
  numerar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ display: "2026-0001" })),
  notificar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ movido: true })),
  avisar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({})),
  responder: vi.fn(async (..._a: unknown[]): Promise<unknown> => "ENVIADO"),
  nivel: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/service-leads/numero", () => ({
  numerarConsultaNueva: H.numerar,
  tituloDeConsulta: (nombre: string, numero: string | null | undefined) => (numero ? `Consulta N° ${numero} · ${nombre}` : nombre),
}));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));
vi.mock("@/lib/plantillas/automaticos", () => ({ responderConsultaNueva: H.responder }));
vi.mock("./aviso", () => ({ avisarConsultaNueva: H.avisar }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));

const A = await import("./alta");
const K = await import("./constantes");
const M = A.MENSAJES_ALTA;

const WEB = { origenDelAlta: "WEB" } as const;
const MANUAL = { origenDelAlta: "MANUAL" } as const;
const SISTEMA = A.altaDelSistema("ws-1");
const EQUIPO = {
  workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF",
  acceso: { role: "STAFF", levels: { "service-leads": "MANAGE" } } as never,
};
const ENTRADA = { contacto: { nombre: "Laura Pérez", email: "laura@persona.test", telefono: "341 555-0000" }, eventType: "BODA" };

const leads = () => B.datos.serviceSalesLead;
const consultas = () => B.datos.fotofficeConsulta;
const categoria = (nombre: string, ws = "ws-1") =>
  B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === ws && c.name === nombre)!.id as string;
const orden = (f: { mock: { invocationCallOrder: number[] } }) => f.mock.invocationCallOrder[0] ?? Infinity;

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  for (const f of [H.numerar, H.notificar, H.avisar, H.responder]) f.mockClear();
  H.numerar.mockResolvedValue({ display: "2026-0001" });
  H.notificar.mockImplementation(async (ws: unknown, sujeto: unknown) => {
    // Como el motor real: abre el recorrido de venta de la consulta.
    B.agregar("fotofficeJourney", { workspaceId: ws, subjectType: "CAPTACION", subjectId: (sujeto as { id: string }).id, kind: "VENTA", circuitId: "c" });
    return { movido: true };
  });
  H.avisar.mockResolvedValue({});
  H.responder.mockResolvedValue("ENVIADO");
  H.nivel.mockReset();
  H.nivel.mockResolvedValue(true);
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: K.SLUG_DNX });
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otra" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  const log = JSON.stringify(errores.mock.calls);
  expect(log).not.toContain("laura");
  expect(log).not.toContain("Laura");
  errores.mockRestore();
});

describe("altaDeConsulta: la transacción", () => {
  it("formulario web: contacto nuevo, consulta vieja y su ficha con la categoría equivalente", async () => {
    const r = await A.altaDeConsulta(SISTEMA, { ...ENTRADA, eventDate: new Date("2026-12-20"), eventLocation: "Salón Real" }, WEB);
    expect(r).toMatchObject({ ok: true, avisos: {} });
    if (!r.ok) return;
    expect(leads()).toHaveLength(1);
    expect(leads()[0]).toMatchObject({
      id: r.leadId, workspaceId: "ws-1", name: "Laura Pérez", email: "laura@persona.test", eventType: "BODA", status: "NEW",
      eventDate: new Date("2026-12-20"), eventLocation: "Salón Real",
    });
    expect(consultas()).toHaveLength(1);
    expect(consultas()[0]).toMatchObject({
      id: r.consultaId, leadId: r.leadId, clientId: r.clientId, categoryId: categoria("Boda"),
      eventStartsAt: new Date("2026-12-20"), eventTimeKnown: false, venue: "Salón Real",
    });
    expect(B.datos.client).toHaveLength(1);
    expect(B.datos.client[0]).toMatchObject({ firstName: "Laura", lastName: "Pérez", email: "laura@persona.test", phone: "3415550000" });
    expect(B.datos.fotofficeContactoPerfil[0]).toMatchObject({ clientId: r.clientId, category: "CONTACTO" });
    // Los catálogos se sembraron solos (DNX: 21 categorías).
    expect(B.datos.fotofficeConsultaCategoria).toHaveLength(21);
  });

  it("si algo de la transacción falla, no queda nada (ni el contacto) y no corre ningún paso", async () => {
    const r = await A.altaDeConsulta(SISTEMA, { ...ENTRADA, participantes: [{ clientId: "no-existe", roleId: "tampoco" }] }, WEB);
    expect(r).toEqual({ ok: false, error: M.participante });
    expect(leads()).toHaveLength(0);
    expect(consultas()).toHaveLength(0);
    expect(B.datos.client).toHaveLength(0);
    for (const f of [H.numerar, H.notificar, H.avisar, H.responder]) expect(f).not.toHaveBeenCalled();
  });

  it("una falla de la base (no de validación) devuelve un error genérico y loguea sólo el código", async () => {
    const original = B.tablas.fotofficeConsulta.create;
    B.tablas.fotofficeConsulta.create = async () => {
      throw Object.assign(new Error("Laura Pérez laura@persona.test"), { code: "P2003" });
    };
    expect(await A.altaDeConsulta(SISTEMA, ENTRADA, WEB)).toEqual({ ok: false, error: M.fallo });
    B.tablas.fotofficeConsulta.create = original;
    expect(leads()).toHaveLength(0);
    expect(JSON.stringify(errores.mock.calls)).toContain("P2003");
  });

  it("web empareja SÓLO por correo (R3); el alta manual también por teléfono", async () => {
    B.agregar("client", { id: "c-viejo", workspaceId: "ws-1", clientNumber: 1, firstName: "Otra", phone: "3415550000" });
    const manual = await A.altaDeConsulta(EQUIPO, { ...ENTRADA, contacto: { nombre: "Laura", telefono: "341 555-0000" } }, MANUAL);
    expect(manual.ok && manual.clientId).toBe("c-viejo");
    const web = await A.altaDeConsulta(SISTEMA, { ...ENTRADA, contacto: { nombre: "Laura", telefono: "341 555-0000" } }, WEB);
    expect(web.ok && web.clientId).not.toBe("c-viejo");
    expect(B.datos.client).toHaveLength(2);
  });

  it("contacto existente por id: del workspace; la consulta vieja copia su nombre y datos", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", clientNumber: 1, firstName: "Ana", lastName: "Paz", email: "ana@x.test", phone: "341" });
    B.agregar("client", { id: "cx", workspaceId: "ws-2", clientNumber: 1, firstName: "Ajena" });
    expect(await A.altaDeConsulta(EQUIPO, { contacto: { clientId: "cx" }, eventType: "BODA" }, MANUAL)).toEqual({
      ok: false, error: M.contactoNoEncontrado,
    });
    const r = await A.altaDeConsulta(EQUIPO, { contacto: { clientId: "c1" }, categoriaId: categoria("Bautismo") }, MANUAL);
    expect(r).toMatchObject({ ok: true, clientId: "c1" });
    expect(leads()[0]).toMatchObject({ name: "Ana Paz", email: "ana@x.test", phone: "341", eventType: "EVENTO_RELIGIOSO" });
    // Una categoría sin tipo viejo deja "OTRO_EVENTO".
    await A.altaDeConsulta(EQUIPO, { contacto: { clientId: "c1" }, categoriaId: categoria("Stand de Glitter") }, MANUAL);
    expect(leads()[1]).toMatchObject({ eventType: "OTRO_EVENTO" });
  });

  it("datos del grupo, origen, referente, valor, cierre y participantes", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", clientNumber: 1, firstName: "Ana" });
    B.agregar("client", { id: "dj", workspaceId: "ws-1", clientNumber: 2, firstName: "DJ" });
    await A.altaDeConsulta(SISTEMA, ENTRADA, WEB); // siembra
    const origen = B.datos.fotofficeOrigen.find((o) => o.name === "Instagram")!.id as string;
    const rol = B.datos.fotofficeRolParticipante.find((x) => x.name === "DJ")!.id as string;
    const inicio = new Date("2026-12-20T23:30:00.000Z"); // 20:30 del 20/12 en Buenos Aires
    const r = await A.altaDeConsulta(EQUIPO, {
      contacto: { clientId: "c1" },
      categoriaId: categoria("Boda"),
      evento: {
        startsAt: inicio, horaConocida: true, ceremonyVenue: "Iglesia", receptionVenue: "Salón", city: "Rosario", guests: 120,
        partnerOneName: "Ana", partnerTwoName: "Juan",
      },
      origenId: origen, referenteClientId: "dj", valorEstimado: 850000.5, cierrePrevisto: new Date("2026-11-01"),
      message: "Nota inicial",
      participantes: [{ clientId: "dj", roleId: rol, note: "  confirmado " }, { clientId: "dj", roleId: rol }],
    }, MANUAL);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(consultas().find((c) => c.id === r.consultaId)).toMatchObject({
      eventStartsAt: inicio, eventTimeKnown: true, ceremonyVenue: "Iglesia", receptionVenue: "Salón", city: "Rosario", guests: 120,
      partnerOneName: "Ana", partnerTwoName: "Juan", originId: origen, referrerClientId: "dj", estimatedValue: 850000.5,
      expectedCloseDate: new Date("2026-11-01"),
    });
    // El día se refleja en la consulta vieja como fecha de calendario; el lugar, el de la recepción.
    expect(leads().find((l) => l.id === r.leadId)).toMatchObject({ eventDate: new Date("2026-12-20"), eventLocation: "Salón", message: "Nota inicial" });
    expect(B.datos.fotofficeConsultaParticipante).toEqual([
      expect.objectContaining({ workspaceId: "ws-1", consultaId: r.consultaId, clientId: "dj", roleId: rol, note: "confirmado" }),
    ]);
  });

  it("aislamiento: categoría, origen, referente, rol y formulario de otro workspace no sirven", async () => {
    await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    await A.altaDeConsulta(A.altaDelSistema("ws-2"), ENTRADA, WEB);
    B.agregar("client", { id: "cx", workspaceId: "ws-2", clientNumber: 9, firstName: "X" });
    B.agregar("serviceLeadForm", { id: "fx", workspaceId: "ws-2", slug: "x", name: "x", eventType: "BODA", configJson: {} });
    const ajenaCat = categoria("Boda", "ws-2");
    const ajenoOrigen = B.datos.fotofficeOrigen.find((o) => o.workspaceId === "ws-2")!.id as string;
    const antes = leads().length;
    expect(await A.altaDeConsulta(SISTEMA, { ...ENTRADA, categoriaId: ajenaCat }, MANUAL)).toEqual({ ok: false, error: M.categoria });
    expect(await A.altaDeConsulta(SISTEMA, { ...ENTRADA, origenId: ajenoOrigen }, MANUAL)).toEqual({ ok: false, error: M.origen });
    expect(await A.altaDeConsulta(SISTEMA, { ...ENTRADA, referenteClientId: "cx" }, MANUAL)).toEqual({ ok: false, error: M.referente });
    expect(leads()).toHaveLength(antes);
    const r = await A.altaDeConsulta(SISTEMA, { ...ENTRADA, formId: "fx", formSlug: "x" }, WEB);
    expect(r.ok && leads().find((l) => l.id === r.leadId)).toMatchObject({ formId: null, formSlug: "x" });
  });

  it("categoría archivada: no se ofrece en altas nuevas; el formulario usa su reemplazo", async () => {
    await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    B.datos.fotofficeConsultaCategoria.find((c) => c.name === "Boda")!.archivedAt = new Date();
    expect(await A.altaDeConsulta(EQUIPO, { ...ENTRADA, categoriaId: categoria("Boda") }, MANUAL)).toEqual({ ok: false, error: M.categoria });
    const r = await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    expect(r.ok && consultas().find((c) => c.id === r.consultaId)!.categoryId).not.toBe(categoria("Boda"));
  });

  it("formulario web sin ninguna categoría activa: usa la equivalente archivada y no pierde la consulta", async () => {
    await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    for (const c of B.datos.fotofficeConsultaCategoria) c.archivedAt = new Date();
    const r = await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    expect(r.ok && consultas().find((c) => c.id === r.consultaId)!.categoryId).toBe(categoria("Boda"));
    // Las altas del equipo, en cambio, piden una categoría activa.
    expect(await A.altaDeConsulta(EQUIPO, ENTRADA, MANUAL)).toEqual({ ok: false, error: M.categoria });
  });

  it("permisos: con usuario exige Gestionar en Consultas; el responsable tiene que poder serlo", async () => {
    const soloVer = { ...EQUIPO, acceso: { role: "STAFF", levels: { "service-leads": "VIEW" } } as never };
    expect(await A.altaDeConsulta(soloVer, ENTRADA, MANUAL)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await A.altaDeConsulta(EQUIPO, { ...ENTRADA, responsableUserId: 5 }, MANUAL)).toEqual({ ok: false, error: M.responsable });
    B.agregar("workspaceMembership", { userId: 5, workspaceId: "ws-1", role: "STAFF" });
    H.nivel.mockResolvedValueOnce(false);
    expect(await A.altaDeConsulta(EQUIPO, { ...ENTRADA, responsableUserId: 5 }, MANUAL)).toEqual({ ok: false, error: M.responsable });
    const r = await A.altaDeConsulta(EQUIPO, { ...ENTRADA, responsableUserId: 5 }, MANUAL);
    expect(r.ok).toBe(true);
    // El responsable queda en el recorrido y se le pasa al aviso.
    expect(B.datos.fotofficeJourney[0]).toMatchObject({ ownerUserId: 5 });
    expect(H.avisar).toHaveBeenCalledWith("ws-1", r.ok && r.leadId, { responsableUserId: 5 }, {});
    expect(leads()).toHaveLength(1);
  });

  it("validación: nombre, textos, invitados, valor, origen del alta", async () => {
    expect(await A.altaDeConsulta(SISTEMA, { contacto: { nombre: "  " } }, WEB)).toEqual({ ok: false, error: M.contacto });
    expect(await A.altaDeConsulta(SISTEMA, { ...ENTRADA, eventLocation: "x".repeat(201) }, WEB)).toEqual({ ok: false, error: M.texto });
    expect(await A.altaDeConsulta(SISTEMA, { ...ENTRADA, evento: { guests: -1 } }, WEB)).toEqual({ ok: false, error: M.invitados });
    expect(await A.altaDeConsulta(SISTEMA, { ...ENTRADA, valorEstimado: -5 }, WEB)).toEqual({ ok: false, error: M.valor });
    expect(await A.altaDeConsulta(SISTEMA, { ...ENTRADA, eventDate: new Date("nada") }, WEB)).toEqual({ ok: false, error: M.fecha });
    expect(await A.altaDeConsulta(SISTEMA, ENTRADA, { origenDelAlta: "OTRO" as never })).toEqual({ ok: false, error: M.datosInvalidos });
    expect(leads()).toHaveLength(0);
  });
});

describe("altaDeConsulta: los pasos de después", () => {
  it("en orden: número → circuito → aviso y tarea → respuesta automática (web)", async () => {
    const r = await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(H.numerar).toHaveBeenCalledWith("ws-1", r.leadId, expect.any(Date));
    expect(H.notificar).toHaveBeenCalledWith("ws-1", { tipo: "CAPTACION", id: r.leadId }, "CONSULTA_RECIBIDA", r.leadId);
    expect(H.avisar).toHaveBeenCalledWith("ws-1", r.leadId, { responsableUserId: null }, {});
    expect(H.responder).toHaveBeenCalledWith("ws-1", r.leadId);
    expect(orden(H.numerar)).toBeLessThan(orden(H.notificar));
    expect(orden(H.notificar)).toBeLessThan(orden(H.avisar));
    expect(orden(H.avisar)).toBeLessThan(orden(H.responder));
  });

  it("cada paso aislado: si uno explota, la consulta queda y los demás corren", async () => {
    const pasos = [H.numerar, H.notificar, H.avisar, H.responder];
    for (const [i, paso] of pasos.entries()) {
      for (const f of pasos) f.mockClear();
      paso.mockRejectedValueOnce(Object.assign(new Error("Laura caída"), { code: `X${i}` }));
      const r = await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
      expect(r.ok, `paso ${i}`).toBe(true);
      for (const f of pasos) expect(f).toHaveBeenCalledTimes(1);
    }
    expect(leads()).toHaveLength(4);
    expect(consultas()).toHaveLength(4);
  });

  it("la respuesta automática sale SÓLO desde el formulario web; la importación tampoco avisa", async () => {
    for (const origenDelAlta of ["MANUAL", "RAPIDA", "IMPORTACION"] as const) {
      expect((await A.altaDeConsulta(EQUIPO, ENTRADA, { origenDelAlta })).ok).toBe(true);
    }
    expect(H.responder).not.toHaveBeenCalled();
    expect(H.avisar).toHaveBeenCalledTimes(2);
    expect(H.numerar).toHaveBeenCalledTimes(3);
    expect(H.notificar).toHaveBeenCalledTimes(3);
    await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    expect(H.responder).toHaveBeenCalledTimes(1);
  });
});

describe("altaDeConsulta: avisos", () => {
  it("posible duplicado: dos contactos con el mismo correo", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", clientNumber: 1, email: "laura@persona.test", createdAt: new Date("2025-01-01") });
    B.agregar("client", { id: "c2", workspaceId: "ws-1", clientNumber: 2, email: "laura@persona.test", createdAt: new Date("2025-06-01") });
    const r = await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    expect(r).toMatchObject({ ok: true, clientId: "c2", avisos: { posibleDuplicado: true } });
  });

  it("fecha superpuesta: otra consulta abierta el mismo día (no las cerradas ni las de otro workspace)", async () => {
    B.agregar("serviceSalesLead", { id: "abierta", workspaceId: "ws-1", name: "Otra", eventType: "XV", eventDate: new Date("2026-12-20") });
    // Guardada con hora: 21:00 del 20/12 en Buenos Aires = 00:00 UTC del 21 (pero no exacto: 00:00:01).
    B.agregar("serviceSalesLead", { id: "conhora", workspaceId: "ws-1", name: "Con hora", eventType: "XV", eventDate: new Date("2026-12-21T00:00:01.000Z") });
    B.agregar("serviceSalesLead", { id: "ganada", workspaceId: "ws-1", name: "Ganada", eventType: "XV", eventDate: new Date("2026-12-20"), status: "WON" });
    B.agregar("serviceSalesLead", { id: "otro-dia", workspaceId: "ws-1", name: "Otro día", eventType: "XV", eventDate: new Date("2026-12-21") });
    B.agregar("serviceSalesLead", { id: "ajena", workspaceId: "ws-2", name: "Ajena", eventType: "XV", eventDate: new Date("2026-12-20") });
    B.agregar("fotofficeRecordNumber", { workspaceId: "ws-1", entityType: "CONSULTA", entityId: "abierta", display: "2026-0007", sequenceKey: "CONSULTA", value: 7 });
    const r = await A.altaDeConsulta(SISTEMA, { ...ENTRADA, eventDate: new Date("2026-12-20") }, WEB);
    expect(r.ok && r.avisos.fechaSuperpuesta).toEqual([
      { leadId: "abierta", display: "Consulta N° 2026-0007 · Otra" },
      { leadId: "conhora", display: "Con hora" },
    ]);
    const sinFecha = await A.altaDeConsulta(SISTEMA, ENTRADA, WEB);
    expect(sinFecha.ok && sinFecha.avisos).toEqual({});
  });
});
