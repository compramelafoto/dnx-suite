import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Importación de consultas desde un CSV: el alta real, el motor real y la base en memoria. */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

// Los pasos de después del alta que no son de esta prueba se reemplazan; el circuito abre el
// recorrido de venta en la primera etapa, como el motor real.
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
  tituloDeConsulta: (nombre: string) => nombre,
}));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));
vi.mock("@/lib/plantillas/automaticos", () => ({ responderConsultaNueva: H.responder }));
vi.mock("./aviso", () => ({ avisarConsultaNueva: H.avisar }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));

const I = await import("./importar");
const K = await import("./constantes");
const M = I.MENSAJES_IMPORTACION_CONSULTAS;

const EQUIPO = {
  workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF",
  acceso: { role: "STAFF", levels: { "service-leads": "MANAGE" } } as never,
};
const SOLO_VER = { ...EQUIPO, acceso: { role: "STAFF", levels: { "service-leads": "VIEW" } } as never };
const OTRO_WS = { ...EQUIPO, workspaceId: "ws-2" };
/** La base en memoria no admite transacciones simultáneas: de a una. */
const SECUENCIAL = { enParalelo: 1 };

const consultas = (ws = "ws-1") => B.datos.fotofficeConsulta.filter((c) => c.workspaceId === ws);
const leads = (ws = "ws-1") => B.datos.serviceSalesLead.filter((c) => c.workspaceId === ws);
const categoria = (nombre: string, ws = "ws-1") =>
  B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === ws && c.name === nombre)!.id as string;
const origen = (nombre: string, ws = "ws-1") => B.datos.fotofficeOrigen.find((c) => c.workspaceId === ws && c.name === nombre)!.id as string;

const ENC = "nombre,correo,telefono,categoria,fecha del evento,lugar,invitados,origen,valor,responsable,etapa,nota";

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  for (const f of [H.numerar, H.notificar, H.avisar, H.responder]) f.mockClear();
  H.notificar.mockImplementation(async (ws: unknown, sujeto: unknown) => {
    B.agregar("fotofficeJourney", {
      workspaceId: ws, subjectType: "CAPTACION", subjectId: (sujeto as { id: string }).id, kind: "VENTA",
      circuitId: ws === "ws-1" ? "circ-1" : "circ-2", stageId: ws === "ws-1" ? "e1" : "x1",
    });
    return { movido: true };
  });
  H.nivel.mockReset();
  H.nivel.mockResolvedValue(true);
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: K.SLUG_DNX });
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otra" });
  // Circuito de ventas de ws-1 con dos etapas activas y una archivada; ws-2 con la suya.
  B.agregar("fotofficeCircuit", { id: "circ-1", workspaceId: "ws-1", name: "Ventas", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeStage", { id: "e1", circuitId: "circ-1", name: "Nueva", order: 0 });
  B.agregar("fotofficeStage", { id: "e2", circuitId: "circ-1", name: "Presupuesto enviado", order: 1, leadStatus: "QUOTED" });
  B.agregar("fotofficeStage", { id: "e3", circuitId: "circ-1", name: "Vieja", order: 2, archivedAt: new Date() });
  B.agregar("fotofficeCircuit", { id: "circ-2", workspaceId: "ws-2", name: "Ventas", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeStage", { id: "x1", circuitId: "circ-2", name: "Ajena", order: 0 });
  // Una vendedora del equipo de ws-1 y alguien de ws-2.
  B.agregar("user", { id: 9, email: "vendedora@estudio.test" });
  B.agregar("workspaceMembership", { userId: 9, workspaceId: "ws-1", role: "STAFF" });
  B.agregar("user", { id: 10, email: "ajena@otro.test" });
  B.agregar("workspaceMembership", { userId: 10, workspaceId: "ws-2", role: "STAFF" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  // Nunca datos personales en el registro.
  const log = JSON.stringify(errores.mock.calls);
  expect(log).not.toContain("@persona.test");
  errores.mockRestore();
});

describe("permisos", () => {
  it("sin «Gestionar» en Consultas, o sin usuario, no analiza ni carga nada", async () => {
    const csv = `${ENC}\nLaura,laura@persona.test,,Boda,20/12/2026,,,,,,,`;
    for (const ctx of [SOLO_VER, { ...EQUIPO, userId: null }]) {
      expect(await I.previsualizarImportacionConsultas(ctx, csv)).toEqual({ ok: false, error: M.sinPermiso });
      expect(await I.importarConsultas(ctx, csv)).toEqual({ ok: false, error: M.sinPermiso });
    }
    expect(B.datos.serviceSalesLead).toHaveLength(0);
    expect(B.datos.fotofficeConsultaCategoria).toHaveLength(0);
  });
});

describe("lectura del CSV", () => {
  it("rechaza vacío, sin nombre, más de 2 MB y más de 2.000 filas", () => {
    expect(I.leerCsvConsultas("")).toEqual({ ok: false, error: M.vacio });
    expect(I.leerCsvConsultas("correo,telefono\na@b.test,1")).toEqual({ ok: false, error: M.sinNombre });
    expect(I.leerCsvConsultas(`nombre\n${"x".repeat(2 * 1024 * 1024)}`)).toEqual({ ok: false, error: M.grande });
    const muchas = `nombre\n${Array.from({ length: K.MAX_FILAS_IMPORTACION + 1 }, (_x, i) => `P${i}`).join("\n")}`;
    expect(I.leerCsvConsultas(muchas)).toEqual({ ok: false, error: M.demasiadas });
    const justas = `nombre\n${Array.from({ length: K.MAX_FILAS_IMPORTACION }, (_x, i) => `P${i}`).join("\n")}`;
    expect(I.leerCsvConsultas(justas).ok).toBe(true);
  });

  it("reconoce los encabezados con alias, tildes y mayúsculas", () => {
    const r = I.leerCsvConsultas(
      "﻿Nombre y apellido,E-mail,Teléfono,Tipo de evento,Fecha,Salón,Cantidad de invitados,¿Cómo nos conociste?,Presupuesto,Correo del responsable,Estado,Observaciones\n" +
        "Laura,laura@persona.test,341 555,Boda,20/12/2026,Salón Real,120,Instagram,150.000,v@x.test,Nueva,Hola",
    );
    expect(r).toEqual({
      ok: true,
      filas: [{
        nombre: "Laura", correo: "laura@persona.test", telefono: "341 555", categoria: "Boda", fecha: "20/12/2026", lugar: "Salón Real",
        invitados: "120", origen: "Instagram", valor: "150.000", responsable: "v@x.test", etapa: "Nueva", nota: "Hola",
      }],
    });
  });

  it("fechas: dd/mm/aaaa y aaaa-mm-dd reales; el resto no", () => {
    expect(I.fechaDelEvento("5/3/2027")).toBe("2027-03-05");
    expect(I.fechaDelEvento("2027-03-05")).toBe("2027-03-05");
    expect(I.fechaDelEvento("31/02/2027")).toBeNull();
    expect(I.fechaDelEvento("mañana")).toBeNull();
    expect(I.fechaDelEvento("01/01/1800")).toBeNull();
  });
});

describe("vista previa", () => {
  it("errores por fila; las válidas se cuentan igual y no se carga nada", async () => {
    const csv = [
      ENC,
      "Laura,laura@persona.test,341 555-0000,Boda,20/12/2026,Salón Real,120,Instagram,150.000,vendedora@estudio.test,Presupuesto enviado,Vino por IG",
      ",sin@persona.test,,,,,,,,,,",
      "Mala,no-es-correo,,Inexistente,31/02/2026,,muchos,Radio,$100,ajena@otro.test,Vieja,",
      "Sin categoría,sincat@persona.test,,,,,,,,,,",
    ].join("\n");
    const r = await I.previsualizarImportacionConsultas(EQUIPO, csv);
    if (!r.ok) throw new Error(r.error);
    expect(r).toMatchObject({ validas: 2, conError: 2, duplicadas: 0 });
    expect(r.filas[0]).toMatchObject({ fila: 1, estado: "VALIDA", categoria: "Boda", fecha: "2026-12-20", etapa: "Presupuesto enviado" });
    expect(r.filas[1]).toMatchObject({ estado: "ERROR", errores: ["Falta el nombre."] });
    const e = r.filas[2]!.errores.join(" | ");
    for (const m of ["correo no es válido", "categoría activa llamada «Inexistente»", "fecha del evento no es válida", "invitados no es válida",
      "origen activo llamado «Radio»", "Valor:", "responsable tiene que ser", "etapa activa llamada «Vieja»"]) {
      expect(e).toContain(m);
    }
    // Sin categoría: la de reemplazo ("Otro" o la primera activa), visible en la vista previa.
    expect(r.filas[3]!.estado).toBe("VALIDA");
    expect(r.filas[3]!.categoria).toBeTruthy();
    expect(B.datos.serviceSalesLead).toHaveLength(0);
    expect(B.datos.client).toHaveLength(0);
  });

  it("aislamiento: los catálogos, etapas y responsables de otra organización no valen", async () => {
    // ws-2 tiene los 9 tipos (una "Boda" propia) y su origen "Otro".
    const csv = `${ENC}\nLaura,laura@persona.test,,Boda,,,,Instagram,,vendedora@estudio.test,Nueva,`;
    const r = await I.previsualizarImportacionConsultas(OTRO_WS, csv);
    if (!r.ok) throw new Error(r.error);
    const e = r.filas[0]!.errores.join(" | ");
    expect(e).toContain("origen activo llamado «Instagram»");
    expect(e).toContain("responsable tiene que ser");
    expect(e).toContain("etapa activa llamada «Nueva»");
    // Su propia "Boda" sí la reconoce.
    expect(e).not.toContain("categoría");
  });
});

describe("importar", () => {
  it("carga por el alta de importación: contacto, datos, sin avisos ni respuesta automática", async () => {
    B.agregar("client", { id: "c-viejo", workspaceId: "ws-1", clientNumber: 1, firstName: "Laura", phone: "3415550000" });
    const csv = [
      ENC,
      "Laura Pérez,,341 555-0000,Boda,20/12/2026,Salón Real,120,Instagram,150.000,vendedora@estudio.test,,Vino por IG",
      "Pedro Gómez,pedro@persona.test,,bautismo,2027-03-05,,,,,,,",
    ].join("\n");
    const r = await I.importarConsultas(EQUIPO, csv, SECUENCIAL);
    expect(r).toMatchObject({ ok: true, creadas: 2, conError: 0, duplicadas: 0, fallidas: [], sinEtapa: [] });
    expect(consultas()).toHaveLength(2);
    const laura = consultas().find((c) => c.clientId === "c-viejo");
    // Contacto existente por teléfono (lo carga el estudio: correo o teléfono).
    expect(laura).toMatchObject({
      categoryId: categoria("Boda"), originId: origen("Instagram"), estimatedValue: 150000, guests: 120, venue: "Salón Real",
      eventStartsAt: new Date("2026-12-20T00:00:00.000Z"), eventTimeKnown: false,
    });
    const lead = leads().find((l) => l.id === laura!.leadId);
    expect(lead).toMatchObject({ message: "Vino por IG", eventDate: new Date("2026-12-20T00:00:00.000Z"), eventLocation: "Salón Real" });
    // El responsable elegido queda en el recorrido.
    expect(B.datos.fotofficeJourney.find((j) => j.subjectId === laura!.leadId)).toMatchObject({ ownerUserId: 9 });
    // Pedro: contacto nuevo.
    expect(B.datos.client.some((c) => c.email === "pedro@persona.test")).toBe(true);
    // Sin avisos al equipo ni respuesta automática; sí número y circuito.
    expect(H.avisar).not.toHaveBeenCalled();
    expect(H.responder).not.toHaveBeenCalled();
    expect(H.numerar).toHaveBeenCalledTimes(2);
    expect(H.notificar).toHaveBeenCalledTimes(2);
  });

  it("no duplica: contra la base, dentro del archivo y al repetir la importación", async () => {
    const csv = [
      ENC,
      "Laura,laura@persona.test,,Boda,20/12/2026,,,,,,,",
      "Laura otra vez,LAURA@persona.test,,Boda,2026-12-20,,,,,,,",
      "Laura otra fecha,laura@persona.test,,Boda,21/12/2026,,,,,,,",
      "Sin correo,,341,Boda,20/12/2026,,,,,,,",
    ].join("\n");
    const r1 = await I.importarConsultas(EQUIPO, csv, SECUENCIAL);
    expect(r1).toMatchObject({ ok: true, creadas: 3, duplicadas: 1 });
    const r2 = await I.previsualizarImportacionConsultas(EQUIPO, csv);
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.filas.map((f) => f.estado)).toEqual(["DUPLICADA", "DUPLICADA", "DUPLICADA", "VALIDA"]);
    expect(r2.filas[0]!.errores[0]).toMatch(/Ya hay una consulta/);
    // Otra organización con el mismo correo no cuenta como duplicado.
    const r3 = await I.previsualizarImportacionConsultas(OTRO_WS, `${ENC}\nLaura,laura@persona.test,,Boda,20/12/2026,,,,,,,`);
    expect(r3.ok && r3.filas[0]!.estado).toBe("VALIDA");
  });

  it("la etapa por nombre mueve el recorrido con el motor después del alta", async () => {
    const csv = `${ENC}\nLaura,laura@persona.test,,Boda,,,,,,,presupuesto ENVIADO,\nPedro,pedro@persona.test,,Boda,,,,,,,Nueva,`;
    const r = await I.importarConsultas(EQUIPO, csv, SECUENCIAL);
    expect(r).toMatchObject({ ok: true, creadas: 2, sinEtapa: [] });
    const laura = leads().find((l) => l.email === "laura@persona.test")!;
    const j = B.datos.fotofficeJourney.find((x) => x.subjectId === laura.id)!;
    expect(j.stageId).toBe("e2");
    expect(B.datos.fotofficeJourneyStep.find((s) => s.journeyId === j.id && s.toStageId === "e2")).toMatchObject({
      fromStageId: "e1", note: "Importada desde un CSV", actorUserId: 7,
    });
    // El estado compatible de la consulta sigue a la etapa.
    expect(laura.status).toBe("QUOTED");
    // Pedro ya estaba en "Nueva": no se mueve.
    const pedro = leads().find((l) => l.email === "pedro@persona.test")!;
    expect(B.datos.fotofficeJourney.find((x) => x.subjectId === pedro.id)!.stageId).toBe("e1");
  });

  it("si el motor no puede mover, la consulta queda cargada en su etapa y se informa", async () => {
    // La primera etapa exige tareas y el recorrido entra con una obligatoria pendiente.
    B.datos.fotofficeStage.find((s) => s.id === "e1")!.requireTasks = true;
    H.notificar.mockImplementationOnce(async (ws: unknown, sujeto: unknown) => {
      const j = B.agregar("fotofficeJourney", {
        workspaceId: ws, subjectType: "CAPTACION", subjectId: (sujeto as { id: string }).id, kind: "VENTA", circuitId: "circ-1", stageId: "e1",
      });
      B.agregar("fotofficeTask", { workspaceId: ws, journeyId: j.id, stageId: "e1", subjectType: "CAPTACION", subjectId: (sujeto as { id: string }).id, title: "Llamar", required: true });
      return { movido: true };
    });
    const r = await I.importarConsultas(EQUIPO, `${ENC}\nLaura,laura@persona.test,,Boda,,,,,,,Presupuesto enviado,`, SECUENCIAL);
    expect(r).toMatchObject({ ok: true, creadas: 1, sinEtapa: [{ fila: 1, error: "Faltan tareas obligatorias: Llamar." }] });
    expect(consultas()).toHaveLength(1);
    expect(B.datos.fotofficeJourney[0]!.stageId).toBe("e1");
  });

  it("queda en la bitácora de la lista de Consultas, sin datos personales", async () => {
    await I.importarConsultas(EQUIPO, `${ENC}\nLaura,laura@persona.test,,Boda,,,,,,,,\n,x@persona.test,,,,,,,,,,`, SECUENCIAL);
    expect(B.datos.fotofficeListActivity).toHaveLength(1);
    const a = B.datos.fotofficeListActivity[0]!;
    expect(a).toMatchObject({ workspaceId: "ws-1", listKey: "captacion", kind: "BULK_ACTION", action: "IMPORTAR_CSV", rowCount: 1, actorUserId: 7 });
    expect(a.detail).toMatchObject({ filas: 2, creadas: 1, conError: 1 });
    expect(JSON.stringify(a)).not.toContain("@persona.test");
  });
});
