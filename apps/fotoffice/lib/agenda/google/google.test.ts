import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
// El doble de Google se arma en cada prueba y se entrega por acá: ningún test sale a la red.
const F = vi.hoisted(() => ({ cliente: null as unknown, token: { ok: true, accessToken: "tok" } as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/integrations/access-token", () => ({ getGoogleAccessToken: vi.fn(async () => F.token) }));
vi.mock("./cliente", async (original) => ({ ...(await original<typeof import("./cliente")>()), crearClienteAgenda: () => F.cliente }));

const { CalendarHttpError } = await import("@/lib/bookings/calendar/client");
const E = await import("./empuje");
const T = await import("./traida");
const S = await import("./sincronizar");
const Cal = await import("./calendario");
const { idEventoCita, idEventoEntrega } = await import("../sync-decisiones");
type ClienteAgenda = import("./cliente").ClienteAgenda;
type EventoGoogle = import("../sync-decisiones").EventoGoogle;

const AHORA = new Date("2026-10-09T15:00:00.000Z");

// ---- Doble de Google Calendar -----------------------------------------------------------------

type Ev = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function crearGoogleFalso() {
  let reloj = 0;
  let seq = 0;
  const eventos = new Map<string, Ev>();
  const llamadas: { op: string; id?: string; cuerpo?: Ev; filtro?: unknown }[] = [];
  let fallar: ((op: string) => unknown) | null = null;
  let alCrearCalendario: (() => Promise<void> | void) | null = null;

  const marca = () => new Date(Date.UTC(2026, 9, 9, 12, 0, 0) + ++reloj * 1000).toISOString();
  const tocar = (ev: Ev) => {
    ev.updated = marca();
    ev.etag = `etag-${reloj}`;
    ev.seq = ++seq;
    return { id: ev.id as string, etag: ev.etag as string, updated: ev.updated as string };
  };
  const revisar = (op: string) => {
    const e = fallar?.(op);
    if (e) throw e;
  };

  const cliente: ClienteAgenda = {
    async crearCalendario(resumen) {
      llamadas.push({ op: "crearCalendario", cuerpo: { resumen } });
      revisar("crearCalendario");
      await alCrearCalendario?.();
      return "cal-nuevo";
    },
    async borrarCalendario(id) {
      llamadas.push({ op: "borrarCalendario", id });
    },
    async insertarEvento(_cal, cuerpo, id) {
      llamadas.push({ op: "insert", id, cuerpo: cuerpo as Ev });
      revisar("insert");
      const eid = id ?? `g-${eventos.size + 1}`;
      // Como Google: un id usado (aunque el evento esté borrado) da 409.
      if (eventos.has(eid)) throw new CalendarHttpError(409, "ya existe");
      const ev: Ev = { ...(cuerpo as Ev), id: eid, status: "confirmed" };
      eventos.set(eid, ev);
      return tocar(ev);
    },
    async parchearEvento(_cal, id, cuerpo) {
      llamadas.push({ op: "patch", id, cuerpo: cuerpo as Ev });
      revisar("patch");
      const ev = eventos.get(id);
      if (!ev) throw new CalendarHttpError(404, "no existe");
      Object.assign(ev, cuerpo); // sin `status` en el cuerpo, un evento cancelado SIGUE cancelado.
      return tocar(ev);
    },
    async borrarEvento(_cal, id) {
      llamadas.push({ op: "delete", id });
      revisar("delete");
      const ev = eventos.get(id);
      if (!ev) return;
      ev.status = "cancelled";
      tocar(ev);
    },
    async listarEventos(entrada) {
      llamadas.push({ op: "list", filtro: { syncToken: entrada.syncToken ?? null, propiedadPrivada: entrada.propiedadPrivada ?? null } });
      revisar("list");
      let lista = [...eventos.values()];
      if (entrada.syncToken) {
        if (entrada.syncToken === "viejo") throw new CalendarHttpError(410, "token vencido");
        const desde = Number(entrada.syncToken.replace("t", ""));
        lista = lista.filter((e) => e.seq > desde);
      }
      if (entrada.propiedadPrivada) {
        const [k, v] = entrada.propiedadPrivada.split("=");
        lista = lista.filter((e) => e.extendedProperties?.private?.[k!] === v);
      }
      if (entrada.conBorrados === false) lista = lista.filter((e) => e.status !== "cancelled");
      return { events: lista.map((e) => ({ ...e })) as EventoGoogle[], nextSyncToken: `t${seq}`, nextPageToken: null };
    },
  };

  return {
    cliente,
    eventos,
    llamadas,
    ops: (op: string) => llamadas.filter((l) => l.op === op),
    /** Alguien crea o cambia un evento directo en Google. */
    externo(ev: Ev) {
      const previo = eventos.get(ev.id);
      const nuevo: Ev = { status: "confirmed", ...(previo ?? {}), ...ev };
      eventos.set(nuevo.id, nuevo);
      tocar(nuevo);
      return nuevo;
    },
    fallarCon(f: ((op: string) => unknown) | null) {
      fallar = f;
    },
    /** Gancho que corre en medio de `crearCalendario` (simula a otro administrador). */
    alCrearCalendario(f: (() => Promise<void> | void) | null) {
      alCrearCalendario = f;
    },
  };
}

let G: ReturnType<typeof crearGoogleFalso>;

// ---- Datos de prueba --------------------------------------------------------------------------

const citas = () => B.datos.fotofficeCita;
const cita = (id: string) => citas().find((c) => c.id === id)!;
const ajustes = () => B.datos.fotofficeAgendaAjustes.find((a) => a.workspaceId === "ws-1")!;

function nuevaCita(id: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeCita", {
    id, workspaceId: "ws-1", title: `Cita ${id}`, startAt: new Date("2026-10-20T15:00:00.000Z"), endAt: new Date("2026-10-20T16:00:00.000Z"), ...extra,
  });
}

function nuevoProyecto(id: string, extra: Record<string, unknown> = {}, abierto = true) {
  B.agregar("fotofficeProyecto", { id, workspaceId: "ws-1", number: `PRY-${id}`, name: `Boda ${id}`, finalDueDate: new Date("2026-11-20T00:00:00.000Z"), ...extra });
  B.agregar("fotofficeJourney", { id: `j-${id}`, workspaceId: "ws-1", subjectType: "PROYECTO", subjectId: id, kind: "TRABAJO", closedAt: abierto ? null : new Date("2026-10-01") });
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  G = crearGoogleFalso();
  F.cliente = G.cliente;
  F.token = { ok: true, accessToken: "tok" };
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "agenda", enabled: true });
  B.agregar("fotofficeAgendaAjustes", { workspaceId: "ws-1", googleCalendarId: "cal-1" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  // Nada personal en los registros: ni títulos de citas, ni nombres de proyectos, ni la cuenta.
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Cita secreta|Cita c1|Boda|@/);
  errores.mockRestore();
});

// ---- Empuje de citas --------------------------------------------------------------------------

describe("empuje de citas", () => {
  it("una cita nueva se inserta con id determinístico y guarda id, etag y updated de Google", async () => {
    nuevaCita("c1", { title: "Reunión con Ana", location: " Salón ", notes: "Traer fotos" });
    await E.alCambiarCita("ws-1", "c1");
    const [i] = G.ops("insert");
    expect(i!.id).toBe(idEventoCita("c1"));
    expect(i!.cuerpo).toMatchObject({ summary: "Reunión con Ana", location: "Salón", description: "Traer fotos", status: "confirmed" });
    expect(i!.cuerpo!.extendedProperties.private).toEqual({ foKind: "cita", foCitaId: "c1" });
    const ev = G.eventos.get(idEventoCita("c1"))!;
    expect(cita("c1")).toMatchObject({ googleEventId: idEventoCita("c1"), googleEtag: ev.etag, googleUpdatedAt: new Date(ev.updated) });
  });

  it("editar o mover una cita con evento hace patch (sin crear otro)", async () => {
    nuevaCita("c1");
    await E.alCambiarCita("ws-1", "c1");
    cita("c1").title = "Nuevo título";
    cita("c1").startAt = new Date("2026-10-21T15:00:00.000Z");
    cita("c1").endAt = new Date("2026-10-21T16:00:00.000Z");
    await E.alCambiarCita("ws-1", "c1");
    expect(G.ops("insert")).toHaveLength(1);
    expect(G.ops("patch")).toHaveLength(1);
    expect(G.eventos.get(idEventoCita("c1"))).toMatchObject({ summary: "Nuevo título", start: { dateTime: "2026-10-21T15:00:00.000Z" } });
  });

  it("I2: el patch VACÍA el lugar y las notas cuando se borran (el insert no los manda)", async () => {
    nuevaCita("c1", { location: "Salón", notes: "Traer fotos" });
    await E.alCambiarCita("ws-1", "c1");
    expect(G.eventos.get(idEventoCita("c1"))).toMatchObject({ location: "Salón", description: "Traer fotos" });
    cita("c1").location = null;
    cita("c1").notes = "   ";
    await E.alCambiarCita("ws-1", "c1");
    expect(G.eventos.get(idEventoCita("c1"))).toMatchObject({ location: "", description: "" });

    nuevaCita("c2");
    await E.alCambiarCita("ws-1", "c2");
    expect("location" in G.ops("insert")[1]!.cuerpo!).toBe(false);
    expect("description" in G.ops("insert")[1]!.cuerpo!).toBe(false);
  });

  it("anular borra el evento (y se conserva el id para poder revivirlo)", async () => {
    nuevaCita("c1");
    await E.alCambiarCita("ws-1", "c1");
    cita("c1").status = "ANULADA";
    await E.alCambiarCita("ws-1", "c1");
    expect(G.ops("delete")).toEqual([{ op: "delete", id: idEventoCita("c1") }]);
    expect(G.eventos.get(idEventoCita("c1"))!.status).toBe("cancelled");
    expect(cita("c1").googleEventId).toBe(idEventoCita("c1"));
  });

  it("I1: reactivar una cita anulada REVIVE el evento borrado (el patch manda status confirmed)", async () => {
    nuevaCita("c1");
    await E.alCambiarCita("ws-1", "c1");
    cita("c1").status = "ANULADA";
    await E.alCambiarCita("ws-1", "c1");
    cita("c1").status = "AGENDADA";
    await E.alCambiarCita("ws-1", "c1");
    expect(G.ops("patch").at(-1)!.cuerpo!.status).toBe("confirmed");
    expect(G.eventos.get(idEventoCita("c1"))!.status).toBe("confirmed");
  });

  it("una cita anulada que nunca estuvo en Google no llama a Google", async () => {
    nuevaCita("c1", { status: "ANULADA" });
    await E.alCambiarCita("ws-1", "c1");
    expect(G.ops("insert")).toHaveLength(0);
    expect(G.ops("delete")).toHaveLength(0);
  });

  it("si el evento ya no existe en Google (404), se vuelve a crear; y si el id quedó reservado (409), se revive", async () => {
    nuevaCita("c1", { googleEventId: "ajeno-1", googleUpdatedAt: new Date("2026-10-01T00:00:00Z") });
    await E.alCambiarCita("ws-1", "c1");
    expect(G.ops("patch")[0]!.id).toBe("ajeno-1");
    expect(G.ops("insert")[0]!.id).toBe(idEventoCita("c1"));
    expect(cita("c1").googleEventId).toBe(idEventoCita("c1"));

    // Dos empujes seguidos de una cita sin id guardado (carrera): el segundo insert da 409 y pasa a patch.
    nuevaCita("c2");
    await E.alCambiarCita("ws-1", "c2");
    cita("c2").googleEventId = null;
    await E.alCambiarCita("ws-1", "c2");
    expect([...G.eventos.keys()].filter((k) => k === idEventoCita("c2"))).toHaveLength(1);
    expect(G.ops("patch").at(-1)!.id).toBe(idEventoCita("c2"));
  });

  it("con el módulo apagado no consulta ajustes ni llama a Google", async () => {
    B.datos.workspaceFeatureModule.length = 0;
    nuevaCita("c1");
    const original = B.tablas.fotofficeAgendaAjustes.findUnique;
    const espia = vi.fn(original);
    B.tablas.fotofficeAgendaAjustes.findUnique = espia as typeof original;
    try {
      await E.alCambiarCita("ws-1", "c1");
    } finally {
      B.tablas.fotofficeAgendaAjustes.findUnique = original;
    }
    expect(espia).not.toHaveBeenCalled();
    expect(G.llamadas).toHaveLength(0);
    expect(cita("c1").googleEventId).toBeNull();
  });

  it("sin calendario creado, o sin cuenta conectada, no pasa nada", async () => {
    nuevaCita("c1");
    ajustes().googleCalendarId = null;
    await E.alCambiarCita("ws-1", "c1");
    ajustes().googleCalendarId = "cal-1";
    F.token = { ok: false, reason: "NEEDS_RECONSENT" };
    await E.alCambiarCita("ws-1", "c1");
    expect(G.llamadas).toHaveLength(0);
  });

  it("un fallo de Google no lanza ni cambia la cita; se registra sólo un código", async () => {
    nuevaCita("c1", { title: "Cita secreta c1" });
    G.fallarCon((op) => (op === "insert" ? new CalendarHttpError(500, "Cuerpo con datos: cuenta@gmail.com") : null));
    await expect(E.alCambiarCita("ws-1", "c1")).resolves.toBeUndefined();
    expect(cita("c1").googleEventId).toBeNull();
    expect(JSON.stringify(errores.mock.calls)).toContain("HTTP_500");
  });

  it("varias citas comparten un solo pedido de permiso a Google", async () => {
    const { getGoogleAccessToken } = await import("@/lib/integrations/access-token");
    vi.mocked(getGoogleAccessToken).mockClear();
    nuevaCita("c1");
    nuevaCita("c2");
    await E.empujarCitas("ws-1", ["c1", "c2"]);
    expect(getGoogleAccessToken).toHaveBeenCalledTimes(1);
    expect(G.ops("insert")).toHaveLength(2);
  });

  it("una cita de otra organización no se empuja", async () => {
    B.agregar("fotofficeCita", { id: "x", workspaceId: "ws-2", title: "Ajena", startAt: AHORA, endAt: new Date(AHORA.getTime() + 3_600_000) });
    await E.alCambiarCita("ws-1", "x");
    expect(G.llamadas).toHaveLength(0);
  });
});

// ---- Entregas de proyectos --------------------------------------------------------------------

describe("entregas de proyectos", () => {
  it("un proyecto abierto con fecha final es un evento de todo el día «Entrega: …» marcado como entrega", async () => {
    nuevoProyecto("p1");
    await E.alCambiarProyecto("ws-1", "p1");
    const ev = G.eventos.get(idEventoEntrega("p1"))!;
    expect(ev).toMatchObject({ summary: "Entrega: Boda p1", start: { date: "2026-11-20" }, end: { date: "2026-11-21" }, status: "confirmed" });
    expect(ev.extendedProperties.private.foKind).toBe("entrega");
  });

  it("cambiar la fecha final hace patch del mismo evento (insert → 409 → patch)", async () => {
    nuevoProyecto("p1");
    await E.alCambiarProyecto("ws-1", "p1");
    B.datos.fotofficeProyecto[0]!.finalDueDate = new Date("2026-12-01T00:00:00.000Z");
    await E.alCambiarProyecto("ws-1", "p1");
    expect(G.eventos.size).toBe(1);
    expect(G.ops("patch")).toHaveLength(1);
    expect(G.eventos.get(idEventoEntrega("p1"))!.start).toEqual({ date: "2026-12-01" });
  });

  it("suspender o cerrar borra el evento; reanudar lo REVIVE (409 → patch con status confirmed)", async () => {
    nuevoProyecto("p1");
    await E.alCambiarProyecto("ws-1", "p1");
    B.datos.fotofficeProyecto[0]!.suspendedAt = new Date("2026-10-05");
    await E.alCambiarProyecto("ws-1", "p1");
    expect(G.eventos.get(idEventoEntrega("p1"))!.status).toBe("cancelled");
    B.datos.fotofficeProyecto[0]!.suspendedAt = null;
    await E.alCambiarProyecto("ws-1", "p1");
    expect(G.eventos.get(idEventoEntrega("p1"))!.status).toBe("confirmed");

    B.datos.fotofficeJourney[0]!.closedAt = new Date("2026-10-08");
    await E.alCambiarProyecto("ws-1", "p1");
    expect(G.eventos.get(idEventoEntrega("p1"))!.status).toBe("cancelled");
  });

  it("sin fecha final no hay evento; con el módulo apagado no se llama a Google", async () => {
    nuevoProyecto("p1", { finalDueDate: null });
    await E.alCambiarProyecto("ws-1", "p1");
    expect(G.ops("insert")).toHaveLength(0);
    B.datos.workspaceFeatureModule.length = 0;
    nuevoProyecto("p2");
    await E.alCambiarProyecto("ws-1", "p2");
    expect(G.llamadas.filter((l) => l.op === "insert")).toHaveLength(0);
  });

  it("las entregas de los proyectos de un pedido se empujan juntas", async () => {
    nuevoProyecto("p1", { pedidoId: "ped-1" });
    nuevoProyecto("p2", { pedidoId: "ped-1" });
    nuevoProyecto("p3", { pedidoId: "ped-2" });
    await E.empujarEntregasDelPedido("ws-1", "ped-1");
    expect([...G.eventos.keys()].sort()).toEqual([idEventoEntrega("p1"), idEventoEntrega("p2")].sort());
  });

  it("la reconciliación del cron deja sólo lo que corresponde: altas, cambios y bajas, sin tocar lo que ya está bien", async () => {
    nuevoProyecto("ok");
    nuevoProyecto("falta");
    nuevoProyecto("cambia");
    nuevoProyecto("cerrado", {}, false);
    await E.alCambiarProyecto("ws-1", "ok");
    await E.alCambiarProyecto("ws-1", "cambia");
    // Un evento de entrega huérfano (proyecto borrado) y una cita normal que NO se debe tocar.
    G.externo({ id: idEventoEntrega("borrado"), summary: "Entrega: viejo", start: { date: "2026-09-01" }, end: { date: "2026-09-02" }, extendedProperties: { private: { foKind: "entrega" } } });
    G.externo({ id: "cita-suelta", summary: "Reunión", start: { dateTime: "2026-10-20T15:00:00Z" }, end: { dateTime: "2026-10-20T16:00:00Z" }, extendedProperties: { private: { foKind: "cita" } } });
    B.datos.fotofficeProyecto.find((p) => p.id === "cambia")!.finalDueDate = new Date("2026-12-24T00:00:00.000Z");
    G.llamadas.length = 0;

    const { contextoGoogle } = await import("./contexto-google");
    const c = await contextoGoogle("ws-1");
    if (!c.ok) throw new Error("sin contexto");
    const r = await E.reconciliarEntregas("ws-1", c.google);
    expect(r).toMatchObject({ escritas: 2, borradas: 1, errores: [] });
    expect(G.ops("list")[0]!.filtro).toMatchObject({ propiedadPrivada: "foKind=entrega" });
    expect(G.eventos.get(idEventoEntrega("falta"))!.status).toBe("confirmed");
    expect(G.eventos.get(idEventoEntrega("cambia"))!.start).toEqual({ date: "2026-12-24" });
    expect(G.eventos.get(idEventoEntrega("borrado"))!.status).toBe("cancelled");
    expect(G.eventos.get("cita-suelta")!.status).toBe("confirmed");
    expect(G.ops("patch").concat(G.ops("insert")).map((o) => o.id)).not.toContain(idEventoEntrega("ok"));

    // Una segunda pasada ya no escribe nada.
    G.llamadas.length = 0;
    const otra = await E.reconciliarEntregas("ws-1", c.google);
    expect(otra).toMatchObject({ escritas: 0, borradas: 0 });
  });

  it("la reconciliación está acotada por corrida", async () => {
    for (let i = 0; i < 5; i++) nuevoProyecto(`p${i}`);
    const { contextoGoogle } = await import("./contexto-google");
    const c = await contextoGoogle("ws-1");
    if (!c.ok) throw new Error("sin contexto");
    const r = await E.reconciliarEntregas("ws-1", c.google, 3);
    expect(r.escritas).toBe(3);
  });
});

// ---- Traída -----------------------------------------------------------------------------------

describe("traída desde Google", () => {
  const externo = (id: string, extra: Ev = {}) =>
    G.externo({ id, summary: "Reunión en Google", start: { dateTime: "2026-10-22T13:00:00-03:00" }, end: { dateTime: "2026-10-22T14:00:00-03:00" }, ...extra });
  const traer = async () => {
    const { contextoGoogle } = await import("./contexto-google");
    const c = await contextoGoogle("ws-1");
    if (!c.ok) throw new Error("sin contexto");
    return T.traerCambios("ws-1", c.google, AHORA);
  };

  it("un evento nuevo en Google se vuelve una cita sin tipo ni responsable, con lugar y notas", async () => {
    externo("g1", { location: "Estudio", description: "Llevar contrato" });
    const r = await traer();
    expect(r.creadas).toBe(1);
    expect(citas()).toHaveLength(1);
    expect(citas()[0]).toMatchObject({
      workspaceId: "ws-1", title: "Reunión en Google", status: "AGENDADA", typeId: null, ownerUserId: null, allDay: false,
      location: "Estudio", notes: "Llevar contrato", googleEventId: "g1",
    });
    expect(citas()[0]!.startAt).toEqual(new Date("2026-10-22T16:00:00.000Z"));
  });

  it("guarda el syncToken y la hora de la última sincronización; la corrida siguiente lo usa", async () => {
    externo("g1");
    await traer();
    expect(ajustes()).toMatchObject({ googleSyncToken: "t1", googleLastSyncAt: AHORA });
    await traer();
    expect(G.ops("list").at(-1)!.filtro).toMatchObject({ syncToken: "t1" });
    expect(citas()).toHaveLength(1);
  });

  it("un cambio posterior en Google actualiza la cita; uno anterior o igual no", async () => {
    externo("g1");
    await traer();
    externo("g1", { summary: "Cambió en Google" });
    await traer();
    expect(citas()[0]!.title).toBe("Cambió en Google");

    // Un evento VIEJO (updated anterior a lo que la cita ya tiene) no pisa lo local.
    cita(citas()[0]!.id as string).title = "Local";
    G.externo({ id: "g1", summary: "Viejo", updated: "2020-01-01T00:00:00.000Z" });
    G.eventos.get("g1")!.updated = "2020-01-01T00:00:00.000Z";
    await traer();
    expect(citas()[0]!.title).toBe("Local");
  });

  it("un evento borrado en Google anula la cita", async () => {
    externo("g1");
    await traer();
    G.externo({ id: "g1", status: "cancelled" });
    const r = await traer();
    expect(r.anuladas).toBe(1);
    expect(citas()[0]!.status).toBe("ANULADA");
  });

  it("ignora las entregas de proyectos (sólo ida): ni crea citas ni mueve la fecha del proyecto", async () => {
    nuevoProyecto("p1");
    await E.alCambiarProyecto("ws-1", "p1");
    G.externo({ id: idEventoEntrega("p1"), start: { date: "2027-01-01" }, end: { date: "2027-01-02" } });
    const r = await traer();
    expect(citas()).toHaveLength(0);
    expect(r.ignorados).toBeGreaterThan(0);
    expect(B.datos.fotofficeProyecto[0]!.finalDueDate).toEqual(new Date("2026-11-20T00:00:00.000Z"));
  });

  it("un evento de todo el día (fin exclusivo) se vuelve una cita de todo el día", async () => {
    G.externo({ id: "g2", summary: "Feriado", start: { date: "2026-10-12" }, end: { date: "2026-10-13" } });
    await traer();
    expect(citas()[0]).toMatchObject({ allDay: true });
    expect(citas()[0]!.startAt).toEqual(new Date("2026-10-12T03:00:00.000Z"));
    expect(citas()[0]!.endAt).toEqual(new Date("2026-10-13T03:00:00.000Z"));
  });

  it("410 Gone: descarta el token, hace la sincronización completa y guarda el token nuevo", async () => {
    externo("g1");
    ajustes().googleSyncToken = "viejo";
    const r = await traer();
    expect(r.recargaCompleta).toBe(true);
    expect(citas()).toHaveLength(1);
    expect(ajustes().googleSyncToken).toBe("t1");
    expect(G.ops("list").map((l) => (l.filtro as { syncToken: string | null }).syncToken)).toEqual(["viejo", null]);
  });

  it("el eco de lo que empujamos nosotros no cambia nada", async () => {
    nuevaCita("c1", { title: "Local", location: "Salón", notes: "x" });
    await E.alCambiarCita("ws-1", "c1");
    const antes = JSON.stringify(cita("c1"));
    const r = await traer();
    expect(r.creadas + r.actualizadas + r.anuladas).toBe(0);
    expect(citas()).toHaveLength(1);
    expect(JSON.stringify(cita("c1"))).toBe(antes);
  });

  it("un evento propio cuyo id todavía no se guardó se enlaza a su cita en vez de duplicarla", async () => {
    nuevaCita("c1");
    // El empuje alcanzó a crear el evento en Google pero no a guardar el id local.
    G.externo({
      id: idEventoCita("c1"), summary: "Cita c1", start: { dateTime: "2026-10-20T15:00:00Z" }, end: { dateTime: "2026-10-20T16:00:00Z" },
      extendedProperties: { private: { foKind: "cita", foCitaId: "c1" } },
    });
    const r = await traer();
    expect(r.enlazadas).toBe(1);
    expect(citas()).toHaveLength(1);
    expect(cita("c1").googleEventId).toBe(idEventoCita("c1"));
  });

  it("si un evento no se pudo aplicar, el token NO avanza (se reintenta)", async () => {
    externo("g1");
    const original = B.tablas.fotofficeCita.create;
    B.tablas.fotofficeCita.create = async () => {
      throw new Error("falla");
    };
    try {
      await traer();
    } finally {
      B.tablas.fotofficeCita.create = original;
    }
    expect(ajustes().googleSyncToken).toBeNull();
    await traer();
    expect(citas()).toHaveLength(1);
  });

  it("sólo toca las citas de su organización", async () => {
    B.agregar("fotofficeCita", { id: "otra", workspaceId: "ws-2", title: "Otra", startAt: AHORA, endAt: new Date(AHORA.getTime() + 3_600_000), googleEventId: "g1" });
    externo("g1");
    await traer();
    expect(B.datos.fotofficeCita.find((c) => c.id === "otra")!.title).toBe("Otra");
    expect(citas().filter((c) => c.workspaceId === "ws-1")).toHaveLength(1);
  });
});

// ---- Corrida completa y cron ------------------------------------------------------------------

describe("traída: evento propio enlazado a una cita anulada (M6)", () => {
  it("borra el evento de Google en vez de dejarlo vivo", async () => {
    nuevaCita("c9", { status: "ANULADA" });
    G.externo({ id: "ev-huerfano", summary: "x", start: { dateTime: "2026-10-22T13:00:00-03:00" }, end: { dateTime: "2026-10-22T14:00:00-03:00" }, extendedProperties: { private: { foCitaId: "c9" } } });
    const { contextoGoogle } = await import("./contexto-google");
    const c = await contextoGoogle("ws-1");
    if (!c.ok) throw new Error("sin contexto");
    await T.traerCambios("ws-1", c.google, AHORA);
    expect(G.ops("delete").map((l) => l.id)).toEqual(["ev-huerfano"]);
    expect(G.eventos.get("ev-huerfano")!.status).toBe("cancelled");
    expect(cita("c9")).toMatchObject({ status: "ANULADA", googleEventId: null });
  });

  it("con la cita viva sigue enlazando, sin borrar", async () => {
    nuevaCita("c8");
    G.externo({ id: "ev-ok", summary: "x", start: { dateTime: "2026-10-22T13:00:00-03:00" }, end: { dateTime: "2026-10-22T14:00:00-03:00" }, extendedProperties: { private: { foCitaId: "c8" } } });
    const { contextoGoogle } = await import("./contexto-google");
    const c = await contextoGoogle("ws-1");
    if (!c.ok) throw new Error("sin contexto");
    const r = await T.traerCambios("ws-1", c.google, AHORA);
    expect(r.enlazadas).toBe(1);
    expect(G.ops("delete")).toHaveLength(0);
    expect(cita("c8").googleEventId).toBe("ev-ok");
  });
});

describe("sincronizar una organización", () => {
  it("empuja lo pendiente, reconcilia las entregas y trae lo nuevo, aislando los errores", async () => {
    nuevaCita("c1");
    nuevoProyecto("p1");
    G.externo({ id: "g1", summary: "Desde Google", start: { dateTime: "2026-10-22T13:00:00-03:00" }, end: { dateTime: "2026-10-22T14:00:00-03:00" } });
    const r = await S.sincronizarAgenda("ws-1", AHORA);
    expect(r).toMatchObject({ citasEmpujadas: 1, entregasEscritas: 1, errores: [] });
    expect(r.traida).toMatchObject({ creadas: 1 });
    expect(G.eventos.has(idEventoCita("c1"))).toBe(true);
    expect(G.eventos.has(idEventoEntrega("p1"))).toBe(true);
    expect(citas()).toHaveLength(2);
  });

  it("un paso que falla no frena a los demás y deja un código", async () => {
    nuevaCita("c1");
    G.fallarCon((op) => (op === "insert" ? new CalendarHttpError(500, "x") : null));
    const r = await S.sincronizarAgenda("ws-1", AHORA);
    expect(r.errores).toContain("CITAS_HTTP_500");
    expect(r.traida).toBeDefined();
  });

  it("con la cuenta revocada se omite con su motivo", async () => {
    F.token = { ok: false, reason: "NEEDS_RECONSENT" };
    const r = await S.sincronizarAgenda("ws-1", AHORA);
    expect(r.omitida).toBe("NEEDS_RECONSENT");
    expect(G.llamadas).toHaveLength(0);
  });

  it("el orden es aleatorio y respeta el tope: ninguna organización queda sin atención para siempre (M1)", async () => {
    for (let i = 2; i <= 30; i += 1) {
      B.agregar("workspaceFeatureModule", { workspaceId: `w${i}`, moduleKey: "agenda", enabled: true });
      B.agregar("fotofficeAgendaAjustes", { workspaceId: `w${i}`, googleCalendarId: `cal-${i}`, googleLastSyncAt: null });
    }
    const vistas = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      const ids = await S.organizacionesParaSincronizar(5);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
      ids.forEach((x) => vistas.add(x));
    }
    expect(vistas.size).toBe(30);
    // Con un "azar" fijo el resultado es determinista.
    expect(await S.organizacionesParaSincronizar(3, () => 0)).toHaveLength(3);
  });

  it("las organizaciones a sincronizar son las que tienen el módulo encendido y el calendario creado", async () => {
    B.agregar("fotofficeAgendaAjustes", { workspaceId: "ws-2", googleCalendarId: "cal-2" }); // sin módulo
    B.agregar("workspaceFeatureModule", { workspaceId: "ws-3", moduleKey: "agenda", enabled: true });
    B.agregar("fotofficeAgendaAjustes", { workspaceId: "ws-3", googleCalendarId: null }); // sin calendario
    expect(await S.organizacionesParaSincronizar(25)).toEqual(["ws-1"]);
  });
});

describe("cron agenda-google-sync", () => {
  it("sin secreto o con uno incorrecto responde 401 y no sincroniza nada", async () => {
    vi.stubEnv("CRON_SECRET", "secreto");
    vi.stubEnv("FOTOFFICE_CRON_SECRET", "");
    const { GET, POST } = await import("@/app/api/cron/agenda-google-sync/route");
    expect((await GET(new Request("http://x/api"))).status).toBe(401);
    expect((await POST(new Request("http://x/api", { method: "POST", headers: { authorization: "Bearer otro" } }))).status).toBe(401);
    expect(G.llamadas).toHaveLength(0);
    vi.unstubAllEnvs();
  });

  it("con el secreto corre por organización y devuelve códigos, no datos", async () => {
    vi.stubEnv("CRON_SECRET", "secreto");
    nuevaCita("c1", { title: "Cita secreta c1" });
    const { GET } = await import("@/app/api/cron/agenda-google-sync/route");
    const res = await GET(new Request("http://x/api", { headers: { authorization: "Bearer secreto" } }));
    expect(res.status).toBe(200);
    const cuerpo = await res.json();
    expect(cuerpo).toMatchObject({ ok: true, workspaces: 1 });
    expect(JSON.stringify(cuerpo)).not.toContain("secreta");
    expect(G.eventos.has(idEventoCita("c1"))).toBe(true);
    vi.unstubAllEnvs();
  });

  it("deja de empezar organizaciones pasado el presupuesto de tiempo y lo informa (M2)", async () => {
    vi.stubEnv("CRON_SECRET", "secreto");
    for (let i = 2; i <= 3; i += 1) {
      B.agregar("workspaceFeatureModule", { workspaceId: `w${i}`, moduleKey: "agenda", enabled: true });
      B.agregar("fotofficeAgendaAjustes", { workspaceId: `w${i}`, googleCalendarId: `cal-${i}` });
    }
    const real = Date.now();
    let t = real;
    const reloj = vi.spyOn(Date, "now").mockImplementation(() => {
      t += 100_000; // cada consulta del reloj "gasta" 100 s
      return t;
    });
    const { GET } = await import("@/app/api/cron/agenda-google-sync/route");
    const res = await GET(new Request("http://x/api", { headers: { authorization: "Bearer secreto" } }));
    reloj.mockRestore();
    const cuerpo = await res.json();
    expect(res.status).toBe(200);
    expect(cuerpo.workspaces + cuerpo.sinAtender).toBe(3);
    expect(cuerpo.sinAtender).toBeGreaterThan(0);
    expect(cuerpo.workspaces).toBeLessThan(3);
    vi.unstubAllEnvs();
  });

  it("no toca las reservas: ni sus calendarios ni sus bloqueos", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const archivos = [
      ...readdirSync(__dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => join(__dirname, f)),
      join(__dirname, "../../../app/api/cron/agenda-google-sync/route.ts"),
    ];
    for (const a of archivos) {
      const fuente = readFileSync(a, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(fuente, a).not.toMatch(/bookingSpace|bookingCalendarBlock|prisma\.booking\b/);
      expect(fuente, a).not.toMatch(/lib\/bookings\/(?!calendar\/client)/);
    }
  });
});

// ---- Crear el calendario ----------------------------------------------------------------------

describe("crear el calendario de la Agenda", () => {
  const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { agenda: "MANAGE" } } as never };
  const STAFF = { workspaceId: "ws-1", userId: 2, userLabel: "Staff", role: "STAFF", acceso: { role: "STAFF", levels: { agenda: "MANAGE" } } as never };

  beforeEach(() => {
    ajustes().googleCalendarId = null;
  });

  it("crea «<organización> Agenda» y guarda el id", async () => {
    const r = await Cal.crearCalendarioDeAgenda(DUENO, "Foto Estudio");
    expect(r).toEqual({ ok: true });
    expect(G.ops("crearCalendario")[0]!.cuerpo).toEqual({ resumen: "Foto Estudio Agenda" });
    expect(ajustes().googleCalendarId).toBe("cal-nuevo");
  });

  it("si otro administrador guardó su calendario mientras tanto, borra el que acaba de crear y no pisa el existente (I1)", async () => {
    G.alCrearCalendario(() => {
      ajustes().googleCalendarId = "cal-del-otro";
    });
    const r = await Cal.crearCalendarioDeAgenda(DUENO, "Foto Estudio");
    expect(r).toEqual({ ok: false, error: Cal.MENSAJES_CALENDARIO.yaExiste });
    expect(ajustes().googleCalendarId).toBe("cal-del-otro");
    expect(G.ops("borrarCalendario").map((l) => l.id)).toEqual(["cal-nuevo"]);
  });

  it("dos envíos simultáneos dejan un solo calendario guardado y borran el sobrante (I1)", async () => {
    const [a, b] = await Promise.all([Cal.crearCalendarioDeAgenda(DUENO, "X"), Cal.crearCalendarioDeAgenda(DUENO, "X")]);
    expect([a, b].filter((x) => x.ok)).toHaveLength(1);
    expect(ajustes().googleCalendarId).toBe("cal-nuevo");
    expect(G.ops("borrarCalendario")).toHaveLength(G.ops("crearCalendario").length - 1);
  });

  it("crea la fila de ajustes si todavía no existía", async () => {
    B.datos.fotofficeAgendaAjustes.length = 0;
    expect(await Cal.crearCalendarioDeAgenda(DUENO, "X")).toEqual({ ok: true });
    expect(ajustes().googleCalendarId).toBe("cal-nuevo");
  });

  it("sólo lo hace quien puede configurar", async () => {
    const r = await Cal.crearCalendarioDeAgenda(STAFF, "Foto Estudio");
    expect(r.ok).toBe(false);
    expect(G.llamadas).toHaveLength(0);
    expect(ajustes().googleCalendarId).toBeNull();
  });

  it("no crea un segundo calendario ni sin cuenta conectada", async () => {
    F.token = { ok: false, reason: "NOT_CONNECTED" };
    expect(await Cal.crearCalendarioDeAgenda(DUENO, "X")).toEqual({ ok: false, error: Cal.MENSAJES_CALENDARIO.sinCuenta });
    F.token = { ok: true, accessToken: "tok" };
    await Cal.crearCalendarioDeAgenda(DUENO, "X");
    expect(await Cal.crearCalendarioDeAgenda(DUENO, "X")).toEqual({ ok: false, error: Cal.MENSAJES_CALENDARIO.yaExiste });
    expect(G.ops("crearCalendario")).toHaveLength(1);
  });

  it("un 403 de Google se explica como falta de permiso, y un 500 como falla pasajera", async () => {
    G.fallarCon(() => new CalendarHttpError(403, "x"));
    expect(await Cal.crearCalendarioDeAgenda(DUENO, "X")).toEqual({ ok: false, error: Cal.MENSAJES_CALENDARIO.sinPermisoGoogle });
    G.fallarCon(() => new CalendarHttpError(500, "x"));
    expect(await Cal.crearCalendarioDeAgenda(DUENO, "X")).toEqual({ ok: false, error: Cal.MENSAJES_CALENDARIO.fallo });
    expect(ajustes().googleCalendarId).toBeNull();
  });
});
