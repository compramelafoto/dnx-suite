import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

// Los pasos de después del alta tienen sus propias pruebas (alta.test): acá sólo abren el
// recorrido como el motor real, para poder cambiar el responsable y la siguiente acción.
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

const E = await import("./edicion");
const K = await import("./constantes");
const { MENSAJES_ALTA: M } = await import("./alta");
const ME = E.MENSAJES_EDICION;

const acceso = (nivel: "VIEW" | "MANAGE") => ({ role: "STAFF", levels: { "service-leads": nivel } }) as never;
const GESTIONA = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF", acceso: acceso("MANAGE") };
const SOLO_VE = { ...GESTIONA, acceso: acceso("VIEW") };
const AJENO = { ...GESTIONA, workspaceId: "ws-2" };

const categoria = (nombre: string, ws = "ws-1") =>
  B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === ws && c.name === nombre)!.id as string;
const origen = (nombre: string, ws = "ws-1") => B.datos.fotofficeOrigen.find((c) => c.workspaceId === ws && c.name === nombre)!.id as string;
const rol = (nombre: string, ws = "ws-1") => B.datos.fotofficeRolParticipante.find((c) => c.workspaceId === ws && c.name === nombre)!.id as string;
const recorridoDe = (leadId: string) => B.datos.fotofficeJourney.find((j) => j.subjectId === leadId)!;

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  B.vaciar();
  for (const f of [H.numerar, H.notificar, H.avisar, H.responder]) f.mockClear();
  H.notificar.mockImplementation(async (ws: unknown, sujeto: unknown) => {
    B.agregar("fotofficeJourney", {
      workspaceId: ws, subjectType: "CAPTACION", subjectId: (sujeto as { id: string }).id, kind: "VENTA", circuitId: "c", stageId: "s1",
    });
    return { movido: true };
  });
  H.nivel.mockReset();
  H.nivel.mockResolvedValue(true);
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: K.SLUG_DNX });
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otra" });
  for (const ws of ["ws-1", "ws-2"]) {
    const { asegurarCatalogosDelWorkspace } = await import("./semillas");
    await asegurarCatalogosDelWorkspace(ws);
  }
  // ws-2 no tiene roles de fábrica: se le carga uno para probar el aislamiento.
  B.agregar("fotofficeRolParticipante", { workspaceId: "ws-2", name: "Salón" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7 });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 8 });
  B.agregar("workspaceMembership", { workspaceId: "ws-2", userId: 9 });
  B.agregar("client", { id: "cli-1", clientNumber: 1, workspaceId: "ws-1", firstName: "Laura", lastName: "Pérez", email: "laura@persona.test", phone: "3415550000", kind: "PERSONA" });
  B.agregar("client", { id: "cli-2", clientNumber: 2, workspaceId: "ws-1", firstName: "Mario", lastName: "Gómez", email: null, phone: null, kind: "PERSONA" });
  B.agregar("client", { id: "cli-ajeno", clientNumber: 1, workspaceId: "ws-2", firstName: "Otra", lastName: "Persona", email: null, phone: null, kind: "PERSONA" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  const log = JSON.stringify(errores.mock.calls);
  expect(log).not.toContain("Laura");
  expect(log).not.toContain("laura@");
  errores.mockRestore();
});

async function nueva(extra: Partial<Parameters<typeof E.crearConsultaManual>[1]> = {}) {
  const r = await E.crearConsultaManual(GESTIONA, { contacto: { clientId: "cli-1" }, categoriaId: categoria("Boda"), ...extra });
  if (!r.ok) throw new Error(r.error);
  return r.leadId;
}

describe("permisos: Ver no alcanza, Gestionar sí", () => {
  it("con sólo «Ver» en Consultas nada escribe ni lee", async () => {
    const leadId = await nueva();
    const antes = JSON.stringify(B.datos);
    const sinPermiso = { ok: false, error: M.sinPermiso };
    expect(await E.crearConsultaManual(SOLO_VE, { contacto: { clientId: "cli-1" }, categoriaId: categoria("Boda") })).toEqual(sinPermiso);
    expect(await E.crearConsultaRapida(SOLO_VE, { nombre: "Ana", telefonoOCorreo: "ana@x.test", categoriaId: categoria("Boda") })).toEqual(sinPermiso);
    expect(await E.editarConsulta(SOLO_VE, leadId, { categoriaId: categoria("Boda") })).toEqual(sinPermiso);
    expect(await E.agregarParticipante(SOLO_VE, leadId, { clientId: "cli-2", roleId: rol("DJ") })).toEqual(sinPermiso);
    expect(await E.quitarParticipante(SOLO_VE, leadId, "x")).toEqual(sinPermiso);
    expect(JSON.stringify(B.datos)).toBe(antes);
  });

  it("sin usuario (contexto del sistema) tampoco: estas altas son del equipo", async () => {
    const sistema = { workspaceId: "ws-1", userId: null, userLabel: "Sistema", role: null };
    expect(await E.crearConsultaManual(sistema, { contacto: { clientId: "cli-1" }, categoriaId: categoria("Boda") })).toEqual({ ok: false, error: M.sinPermiso });
  });
});

describe("Nueva consulta (alta MANUAL)", () => {
  it("con un contacto existente guarda los datos del grupo, origen, referente, valor y cierre", async () => {
    const r = await E.crearConsultaManual(GESTIONA, {
      contacto: { clientId: "cli-1" },
      categoriaId: categoria("Boda"),
      evento: { fecha: "2026-12-20", hora: "21:30", invitados: "150", novio1: "Laura", novio2: "Juan", ceremonia: "Iglesia", recepcion: "Salón Real", ciudad: "Rosario", lugar: "no lo pide la boda" },
      origenId: origen("Instagram"),
      referenteClientId: "cli-2",
      valor: "1.500.000,50",
      cierrePrevisto: "2026-11-01",
      responsableUserId: 8,
      nota: "Quiere video también",
    });
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    const c = B.datos.fotofficeConsulta[0]!;
    expect(c).toMatchObject({
      clientId: "cli-1", categoryId: categoria("Boda"), originId: origen("Instagram"), referrerClientId: "cli-2",
      estimatedValue: 1500000.5, guests: 150, partnerOneName: "Laura", partnerTwoName: "Juan", ceremonyVenue: "Iglesia",
      receptionVenue: "Salón Real", city: "Rosario", venue: null, eventTimeKnown: true,
    });
    expect((c.eventStartsAt as Date).toISOString()).toBe("2026-12-21T00:30:00.000Z");
    expect((c.expectedCloseDate as Date).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    const lead = B.datos.serviceSalesLead[0]!;
    expect((lead.eventDate as Date).toISOString()).toBe("2026-12-20T00:00:00.000Z");
    expect(lead).toMatchObject({ message: "Quiere video también", eventLocation: "Salón Real" });
    expect(recorridoDe(r.leadId).ownerUserId).toBe(8);
    // Alta manual: nunca la respuesta automática.
    expect(H.responder).not.toHaveBeenCalled();
  });

  it("un grupo sin fecha no guarda los datos del evento que no pide", async () => {
    const r = await E.crearConsultaManual(GESTIONA, {
      contacto: { nombre: "Ana Ruiz", email: "ana@persona.test" },
      categoriaId: categoria("Sesión de Fotos"),
      evento: { fecha: "2026-12-20", invitados: "10", lugar: "Parque" },
    });
    expect(r.ok).toBe(true);
    expect(B.datos.fotofficeConsulta[0]).toMatchObject({ eventStartsAt: null, guests: null, venue: null });
    expect(B.datos.serviceSalesLead[0]!.eventDate).toBeNull();
  });

  it("cada id se busca en el workspace de la sesión", async () => {
    const base = { contacto: { clientId: "cli-1" }, categoriaId: categoria("Boda") };
    expect(await E.crearConsultaManual(GESTIONA, { ...base, contacto: { clientId: "cli-ajeno" } })).toEqual({ ok: false, error: M.contactoNoEncontrado });
    expect(await E.crearConsultaManual(GESTIONA, { ...base, categoriaId: categoria("Boda", "ws-2") })).toEqual({ ok: false, error: M.categoria });
    expect(await E.crearConsultaManual(GESTIONA, { ...base, origenId: origen("Otro", "ws-2") })).toEqual({ ok: false, error: M.origen });
    expect(await E.crearConsultaManual(GESTIONA, { ...base, referenteClientId: "cli-ajeno" })).toEqual({ ok: false, error: M.referente });
    // Responsable: alguien de otro workspace, o del equipo sin "Gestionar".
    expect(await E.crearConsultaManual(GESTIONA, { ...base, responsableUserId: 9 })).toEqual({ ok: false, error: M.responsable });
    H.nivel.mockResolvedValue(false);
    expect(await E.crearConsultaManual(GESTIONA, { ...base, responsableUserId: 8 })).toEqual({ ok: false, error: M.responsable });
    expect(B.datos.serviceSalesLead).toHaveLength(0);
    expect(B.datos.fotofficeConsulta).toHaveLength(0);
  });

  it("una categoría archivada no se ofrece en altas nuevas", async () => {
    const id = categoria("Boda");
    B.datos.fotofficeConsultaCategoria.find((c) => c.id === id)!.archivedAt = new Date();
    expect(await E.crearConsultaManual(GESTIONA, { contacto: { clientId: "cli-1" }, categoriaId: id })).toEqual({ ok: false, error: M.categoria });
  });

  it("datos que no se entienden se rechazan sin crear nada", async () => {
    const base = { contacto: { clientId: "cli-1" }, categoriaId: categoria("Boda") };
    expect(await E.crearConsultaManual(GESTIONA, { ...base, valor: "mucho" })).toEqual({ ok: false, error: M.valor });
    expect(await E.crearConsultaManual(GESTIONA, { ...base, evento: { fecha: "2026-02-31" } })).toEqual({ ok: false, error: M.fecha });
    expect(await E.crearConsultaManual(GESTIONA, { ...base, evento: { invitados: "1,5" } })).toEqual({ ok: false, error: M.invitados });
    expect(await E.crearConsultaManual(GESTIONA, { ...base, cierrePrevisto: "mañana" })).toEqual({ ok: false, error: M.fecha });
    expect(await E.crearConsultaManual(GESTIONA, { contacto: { nombre: "  " }, categoriaId: categoria("Boda") })).toEqual({ ok: false, error: M.contacto });
    expect(B.datos.serviceSalesLead).toHaveLength(0);
  });

  it("avisa fecha superpuesta y posible duplicado", async () => {
    const primera = await nueva({ evento: { fecha: "2026-12-20" } });
    // Otro contacto con el mismo correo que Laura.
    B.agregar("client", { id: "cli-3", clientNumber: 3, workspaceId: "ws-1", firstName: "Laura", lastName: "P.", email: "LAURA@persona.test", phone: null, kind: "PERSONA" });
    const r = await E.crearConsultaManual(GESTIONA, { contacto: { clientId: "cli-1" }, categoriaId: categoria("Boda"), evento: { fecha: "2026-12-20" } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Sin número (la numeración está reemplazada en esta prueba), el cartel muestra el nombre.
    expect(r.avisos.fechaSuperpuesta).toEqual([{ leadId: primera, display: "Laura Pérez" }]);
    expect(r.avisos.duplicados).toEqual([{ id: "cli-3", nombre: "P., Laura" }]);
  });
});

describe("alta rápida del tablero", () => {
  it("con correo o con teléfono, y nada más", async () => {
    const a = await E.crearConsultaRapida(GESTIONA, { nombre: "Ana Ruiz", telefonoOCorreo: "ana@persona.test", categoriaId: categoria("Boda") });
    const b = await E.crearConsultaRapida(GESTIONA, { nombre: "Beto Sosa", telefonoOCorreo: "341 444-1111", categoriaId: categoria("Boda") });
    expect([a, b].map((r) => (r.ok ? "ok" : r.error))).toEqual(["ok", "ok"]);
    const clientes = B.datos.client.filter((c) => c.firstName === "Ana" || c.firstName === "Beto");
    expect(clientes.map((c) => [c.email ?? null, c.phone ?? null])).toEqual([["ana@persona.test", null], [null, "3414441111"]]);
    expect(H.responder).not.toHaveBeenCalled();
  });

  it("exige teléfono o correo y una categoría del workspace", async () => {
    expect(await E.crearConsultaRapida(GESTIONA, { nombre: "Ana", telefonoOCorreo: " ", categoriaId: categoria("Boda") })).toEqual({ ok: false, error: ME.contactoRapido });
    expect(await E.crearConsultaRapida(GESTIONA, { nombre: "Ana", telefonoOCorreo: "ana@x.test", categoriaId: categoria("Boda", "ws-2") })).toEqual({ ok: false, error: M.categoria });
  });
});

describe("ficha: editar los datos", () => {
  it("cambia categoría, datos del grupo, origen, referente, valor y cierre, y lo refleja en la consulta vieja", async () => {
    const leadId = await nueva({ evento: { fecha: "2026-12-20", recepcion: "Salón Real" } });
    const r = await E.editarConsulta(GESTIONA, leadId, {
      categoriaId: categoria("Evento Corporativo"),
      evento: { fecha: "2027-03-05", lugar: "Hotel", ciudad: "Funes", invitados: "80" },
      origenId: origen("Google"),
      referenteClientId: "cli-2",
      valor: "200000",
      cierrePrevisto: "2027-01-10",
    });
    expect(r).toEqual({ ok: true });
    expect(B.datos.fotofficeConsulta[0]).toMatchObject({
      categoryId: categoria("Evento Corporativo"), originId: origen("Google"), referrerClientId: "cli-2", estimatedValue: 200000,
      venue: "Hotel", city: "Funes", guests: 80,
      // La recepción no la pide el grupo Evento: no se toca.
      receptionVenue: "Salón Real",
    });
    const lead = B.datos.serviceSalesLead[0]!;
    expect(lead.eventType).toBe("OTRO_EVENTO");
    expect((lead.eventDate as Date).toISOString()).toBe("2027-03-05T00:00:00.000Z");
    expect(lead.eventLocation).toBe("Hotel");
  });

  it("la categoría actual vale aunque esté archivada; otra archivada no", async () => {
    const leadId = await nueva();
    const boda = categoria("Boda");
    B.datos.fotofficeConsultaCategoria.find((c) => c.id === boda)!.archivedAt = new Date();
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: boda, valor: "10" })).toEqual({ ok: true });
    const corpo = categoria("Evento Corporativo");
    B.datos.fotofficeConsultaCategoria.find((c) => c.id === corpo)!.archivedAt = new Date();
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: corpo })).toEqual({ ok: false, error: M.categoria });
  });

  it("cada id se busca en el workspace de la sesión", async () => {
    const leadId = await nueva();
    const boda = categoria("Boda");
    expect(await E.editarConsulta(AJENO, leadId, { categoriaId: boda })).toEqual({ ok: false, error: ME.noEncontrada });
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: categoria("Boda", "ws-2") })).toEqual({ ok: false, error: M.categoria });
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: boda, origenId: origen("Otro", "ws-2") })).toEqual({ ok: false, error: M.origen });
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: boda, referenteClientId: "cli-ajeno" })).toEqual({ ok: false, error: M.referente });
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: boda, responsableUserId: 9 })).toEqual({ ok: false, error: M.responsable });
    H.nivel.mockResolvedValue(false);
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: boda, responsableUserId: 8 })).toEqual({ ok: false, error: M.responsable });
    expect(B.datos.fotofficeConsulta[0]).toMatchObject({ categoryId: boda, originId: null, referrerClientId: null });
    expect(recorridoDe(leadId).ownerUserId).toBeNull();
  });

  it("cambia el responsable por el motor de etapas", async () => {
    const leadId = await nueva();
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: categoria("Boda"), responsableUserId: 8 })).toEqual({ ok: true });
    expect(recorridoDe(leadId).ownerUserId).toBe(8);
  });

  it("la siguiente acción es `stageDueAt` y su cambio queda en el historial", async () => {
    const leadId = await nueva();
    const j = recorridoDe(leadId);
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: categoria("Boda"), siguienteAccion: "2026-10-20" })).toEqual({ ok: true });
    expect((j.stageDueAt as Date).toISOString()).toBe("2026-10-21T02:59:59.999Z");
    const pasos = B.datos.fotofficeJourneyStep.filter((p) => p.journeyId === j.id);
    expect(pasos).toHaveLength(1);
    expect(pasos[0]).toMatchObject({ fromStageId: "s1", toStageId: "s1", actorUserId: 7, actorLabel: "Ana" });
    expect(pasos[0]!.note).toBe("Vencimiento cambiado a 20/10/2026.");

    // La misma fecha otra vez no ensucia el historial; quitarla, sí queda.
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: categoria("Boda"), siguienteAccion: "2026-10-20" })).toEqual({ ok: true });
    expect(B.datos.fotofficeJourneyStep.filter((p) => p.journeyId === j.id)).toHaveLength(1);
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: categoria("Boda"), siguienteAccion: "" })).toEqual({ ok: true });
    expect(j.stageDueAt).toBeNull();
    expect(B.datos.fotofficeJourneyStep.at(-1)!.note).toBe("Vencimiento cambiado a sin vencimiento.");
  });

  it("sin recorrido abierto, el responsable y la siguiente acción no se cambian", async () => {
    const leadId = await nueva();
    recorridoDe(leadId).closedAt = new Date();
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: categoria("Boda"), siguienteAccion: "2026-10-20" })).toEqual({ ok: false, error: ME.sinCircuito });
    expect(await E.editarConsulta(GESTIONA, leadId, { categoriaId: categoria("Boda"), siguienteAccion: "20/10/2026" })).toEqual({ ok: false, error: ME.siguienteAccion });
  });
});

describe("participantes", () => {
  it("agrega y quita, con contacto y rol del workspace", async () => {
    const leadId = await nueva();
    expect(await E.agregarParticipante(GESTIONA, leadId, { clientId: "cli-2", roleId: rol("DJ"), nota: "Llega 20 h" })).toEqual({ ok: true });
    expect(await E.agregarParticipante(GESTIONA, leadId, { clientId: "cli-2", roleId: rol("DJ") })).toEqual({ ok: false, error: ME.participanteRepetido });
    const p = B.datos.fotofficeConsultaParticipante[0]!;
    expect(p).toMatchObject({ workspaceId: "ws-1", clientId: "cli-2", roleId: rol("DJ"), note: "Llega 20 h" });
    expect(await E.quitarParticipante(GESTIONA, leadId, p.id)).toEqual({ ok: true });
    expect(B.datos.fotofficeConsultaParticipante).toHaveLength(0);
  });

  it("aislamiento: contacto, rol, consulta y participante de otro lado no valen", async () => {
    const leadId = await nueva();
    const otraLead = await nueva();
    expect(await E.agregarParticipante(GESTIONA, leadId, { clientId: "cli-ajeno", roleId: rol("DJ") })).toEqual({ ok: false, error: M.contactoNoEncontrado });
    expect(await E.agregarParticipante(GESTIONA, leadId, { clientId: "cli-2", roleId: rol("Salón", "ws-2") })).toEqual({ ok: false, error: ME.rol });
    expect(await E.agregarParticipante(AJENO, leadId, { clientId: "cli-2", roleId: rol("DJ") })).toEqual({ ok: false, error: ME.noEncontrada });
    // Un rol archivado no se ofrece.
    B.datos.fotofficeRolParticipante.find((r) => r.id === rol("Catering"))!.archivedAt = new Date();
    expect(await E.agregarParticipante(GESTIONA, leadId, { clientId: "cli-2", roleId: rol("Catering") })).toEqual({ ok: false, error: ME.rol });
    expect(B.datos.fotofficeConsultaParticipante).toHaveLength(0);

    await E.agregarParticipante(GESTIONA, otraLead, { clientId: "cli-2", roleId: rol("DJ") });
    const deLaOtra = B.datos.fotofficeConsultaParticipante[0]!.id;
    expect(await E.quitarParticipante(GESTIONA, leadId, deLaOtra)).toEqual({ ok: false, error: ME.participanteNoEncontrado });
    expect(await E.quitarParticipante(AJENO, otraLead, deLaOtra)).toEqual({ ok: false, error: ME.noEncontrada });
    expect(B.datos.fotofficeConsultaParticipante).toHaveLength(1);
  });
});
