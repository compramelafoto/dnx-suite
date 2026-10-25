import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Lectura de las capas de la agenda: cada capa se lee SÓLO si su módulo está encendido y la persona tiene
 * permiso (no hay ni una consulta a la base de las demás), y las que se leen traen lo que corresponde.
 */

const P = vi.hoisted(() => {
  const m = () => vi.fn(async (_args?: unknown): Promise<unknown[]> => []);
  return {
    fotofficeCita: { findMany: m(), findFirst: vi.fn() },
    fotofficeProyecto: { findMany: m() },
    fotofficeJourney: { findMany: m() },
    fotofficeTask: { findMany: m() },
    fotofficePedidoCuota: { findMany: m() },
    fotofficeCobroImputacion: { findMany: m() },
    fotofficeCobro: { findMany: m() },
    fotofficeContactoPerfil: { findMany: m() },
    booking: { findMany: m() },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: P }));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: vi.fn() }));
vi.mock("@/lib/proyectos/proyectos", () => ({ suspendidosEntre: vi.fn(async () => new Set<string>(["pr-susp"])) }));
vi.mock("@/lib/circuitos/sujetos", () => ({
  adaptadorDe: (tipo: string) =>
    tipo === "PROYECTO" || tipo === "CAPTACION"
      ? {
          rutaFicha: (id: string) => `/${tipo === "PROYECTO" ? "proyectos" : "consultas"}/${id}`,
          nombre: async (_ws: string, ids: string[]) => new Map(ids.map((id) => [id, { titulo: `Sujeto ${id}`, href: `/${tipo === "PROYECTO" ? "proyectos" : "consultas"}/${id}` }])),
        }
      : null,
}));

const { cargarVistaAgenda } = await import("./vista");
const { rangoMes } = await import("./fechas");

const RANGO = rangoMes("2026-10-15");
const TODOS = new Set(["agenda", "projects", "orders", "service-leads", "clients", "bookings"]);
const NIVELES_TODOS = { agenda: "MANAGE", projects: "MANAGE", orders: "VIEW", "service-leads": "MANAGE", clients: "VIEW", bookings: "VIEW" };

function ctx(role: string, levels: Record<string, string>) {
  return { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role, acceso: { role, levels } } as never;
}
const DUENO = ctx("WORKSPACE_OWNER", NIVELES_TODOS);

const MODELOS = {
  CITAS: P.fotofficeCita,
  ENTREGAS: P.fotofficeProyecto,
  TAREAS: P.fotofficeTask,
  CUOTAS: P.fotofficePedidoCuota,
  CONSULTAS: P.fotofficeJourney,
  CUMPLEANOS: P.fotofficeContactoPerfil,
  RESERVAS: P.booking,
} as const;

/** Cuántas lecturas hizo la capa. Entregas y Consultas comparten la tabla de recorridos: se distinguen por tipo. */
function leidas(capa: keyof typeof MODELOS): number {
  if (capa === "CONSULTAS") return P.fotofficeJourney.findMany.mock.calls.filter((c) => (c[0] as { where: { subjectType: string } }).where.subjectType === "CAPTACION").length;
  return MODELOS[capa].findMany.mock.calls.length;
}

function sembrar() {
  const EN_OCTUBRE = new Date("2026-10-15T15:00:00.000Z");
  P.fotofficeCita.findMany.mockResolvedValue([
    {
      id: "c1", title: "Reunión", typeId: "t1", status: "AGENDADA", startAt: EN_OCTUBRE, endAt: new Date("2026-10-15T16:00:00.000Z"), allDay: false,
      location: null, notes: null, ownerUserId: 7, clientId: "cli1", proyectoId: "pr1", pedidoId: null, consultaLeadId: null,
      type: { color: "#2563eb" }, client: { firstName: "Laura", lastName: "Pérez", businessName: null },
      proyecto: { number: "P-1", name: "Boda Laura" }, pedido: null, consultaLead: null, participantes: [],
    },
  ]);
  P.fotofficeProyecto.findMany.mockResolvedValue([
    { id: "pr1", name: "Boda Laura", finalDueDate: new Date("2026-10-20T00:00:00.000Z"), ownerUserId: 7 },
    { id: "pr-cerrado", name: "Cerrado", finalDueDate: new Date("2026-10-21T00:00:00.000Z"), ownerUserId: 7 },
  ]);
  P.fotofficeTask.findMany.mockResolvedValue([
    { id: "tk1", title: "Armar álbum", dueAt: new Date("2026-10-22T14:00:00.000Z"), assigneeUserId: 7, subjectType: "PROYECTO", subjectId: "pr1" },
    { id: "tk2", title: "De un suspendido", dueAt: new Date("2026-10-23T14:00:00.000Z"), assigneeUserId: 7, subjectType: "PROYECTO", subjectId: "pr-susp" },
  ]);
  P.fotofficeJourney.findMany.mockImplementation(async (args: unknown) => {
    const donde = (args as { where: { subjectType: string } }).where;
    if (donde.subjectType === "PROYECTO") return [{ subjectId: "pr1" }];
    return [{ subjectId: "lead1", stageDueAt: new Date("2026-10-18T13:00:00.000Z"), ownerUserId: 7 }];
  });
  P.fotofficePedidoCuota.findMany.mockImplementation(async (args: unknown) => {
    const a = args as { select: Record<string, unknown> };
    if (a.select.pedido) {
      const pedido = { number: "PED-1", status: "CONFIRMADO", totalArs: "200", client: { firstName: "Laura", lastName: "Pérez", businessName: null } };
      return [
        { id: "q1", pedidoId: "ped1", dueDate: new Date("2026-10-25T00:00:00.000Z"), pedido },
        { id: "q2", pedidoId: "ped1", dueDate: new Date("2026-10-26T00:00:00.000Z"), pedido },
      ];
    }
    return [
      { id: "q1", pedidoId: "ped1", position: 1, dueDate: new Date("2026-10-25T00:00:00.000Z"), amountArs: "100", suggestedMethod: null },
      { id: "q2", pedidoId: "ped1", position: 2, dueDate: new Date("2026-10-26T00:00:00.000Z"), amountArs: "100", suggestedMethod: null },
    ];
  });
  P.fotofficeCobroImputacion.findMany.mockResolvedValue([{ cobroId: "co1", cuotaId: "q1", amountArs: "100" }]);
  P.fotofficeCobro.findMany.mockResolvedValue([{ id: "co1", voidedAt: null }]);
  P.fotofficeContactoPerfil.findMany.mockResolvedValue([
    { id: "pf1", clientId: "cli1", birthday: new Date("1990-10-30T00:00:00.000Z"), client: { firstName: "Laura", lastName: "Pérez", businessName: null } },
    { id: "pf2", clientId: "cli2", birthday: new Date("1985-02-03T00:00:00.000Z"), client: { firstName: "Otro", lastName: "Año", businessName: null } },
  ]);
  P.booking.findMany.mockResolvedValue([
    { id: "b1", startAt: new Date("2026-10-16T13:00:00.000Z"), endAt: new Date("2026-10-16T15:00:00.000Z"), contactName: "Carlos", space: { name: "Estudio" } },
  ]);
}

beforeEach(() => {
  for (const modelo of Object.values(P)) for (const fn of Object.values(modelo)) (fn as ReturnType<typeof vi.fn>).mockReset();
  for (const modelo of Object.values(P)) (modelo as { findMany?: ReturnType<typeof vi.fn> }).findMany?.mockResolvedValue([]);
  sembrar();
});

describe("cargarVistaAgenda", () => {
  it("con todos los permisos arma las siete capas con lo que corresponde de cada una", async () => {
    const v = await cargarVistaAgenda(DUENO, { rango: RANGO, habilitados: TODOS });
    expect(v.capas).toEqual(["CITAS", "ENTREGAS", "TAREAS", "CUOTAS", "CONSULTAS", "CUMPLEANOS", "RESERVAS"]);
    const porCapa = (c: string) => v.eventos.filter((e) => e.capa === c).map((e) => e.titulo);
    expect(porCapa("CITAS")).toEqual(["Reunión"]);
    // Sólo el proyecto con recorrido abierto.
    expect(porCapa("ENTREGAS")).toEqual(["Entrega: Boda Laura"]);
    // La tarea del proyecto suspendido no aparece.
    expect(porCapa("TAREAS")).toEqual(["Armar álbum · Sujeto pr1"]);
    // Sólo la cuota con saldo (q1 está cobrada completa).
    expect(porCapa("CUOTAS")).toEqual(["Cuota · Laura Pérez · pedido PED-1"]);
    expect(porCapa("CONSULTAS")).toEqual(["Consulta: Sujeto lead1"]);
    // Sólo el cumpleaños del rango, sin importar el año de nacimiento.
    expect(porCapa("CUMPLEANOS")).toEqual(["Cumpleaños: Laura Pérez"]);
    expect(porCapa("RESERVAS")).toEqual(["Estudio · Carlos"]);
    // La cita lleva su detalle y es editable con Gestionar; las demás no.
    expect(v.citas[0]).toMatchObject({ id: "c1", clientNombre: "Laura Pérez", origen: [{ tipo: "proyecto", href: "/proyectos/pr1" }] });
    expect(v.eventos.filter((e) => e.editable).map((e) => e.capa)).toEqual(["CITAS"]);
    expect(v.truncadas).toEqual([]);
  });

  it.each([
    ["CITAS", { agenda: "NONE" }],
    ["ENTREGAS", { projects: "NONE" }],
    ["CUOTAS", { orders: "NONE" }],
    ["CONSULTAS", { "service-leads": "NONE" }],
    ["CUMPLEANOS", { clients: "NONE" }],
    ["RESERVAS", { bookings: "NONE" }],
  ] as const)("sin Ver en el módulo, la capa %s ni se consulta", async (capa, niveles) => {
    const v = await cargarVistaAgenda(ctx("WORKSPACE_OWNER", { ...NIVELES_TODOS, ...niveles }), { rango: RANGO, habilitados: TODOS });
    expect(v.capas).not.toContain(capa);
    expect(leidas(capa)).toBe(0);
    expect(v.eventos.some((e) => e.capa === capa)).toBe(false);
  });

  it.each([
    ["CITAS", "agenda"],
    ["ENTREGAS", "projects"],
    ["CUOTAS", "orders"],
    ["CONSULTAS", "service-leads"],
    ["CUMPLEANOS", "clients"],
    ["RESERVAS", "bookings"],
  ] as const)("con el módulo apagado, la capa %s ni se consulta", async (capa, modulo) => {
    const v = await cargarVistaAgenda(DUENO, { rango: RANGO, habilitados: new Set([...TODOS].filter((m) => m !== modulo)) });
    expect(v.capas).not.toContain(capa);
    expect(leidas(capa)).toBe(0);
    expect(v.eventos.some((e) => e.capa === capa)).toBe(false);
  });

  it("las tareas no se consultan sin Gestionar en Proyectos ni en Consultas", async () => {
    const v = await cargarVistaAgenda(ctx("STAFF", { ...NIVELES_TODOS, projects: "VIEW", "service-leads": "VIEW" }), { rango: RANGO, habilitados: TODOS });
    expect(v.capas).not.toContain("TAREAS");
    expect(P.fotofficeTask.findMany).not.toHaveBeenCalled();
  });

  it("las cuotas no se consultan sin permiso de dinero, aunque pueda ver Pedidos", async () => {
    const v = await cargarVistaAgenda(ctx("STAFF", NIVELES_TODOS), { rango: RANGO, habilitados: TODOS });
    expect(v.capas).toContain("ENTREGAS");
    expect(v.capas).not.toContain("CUOTAS");
    expect(P.fotofficePedidoCuota.findMany).not.toHaveBeenCalled();
    const conCaja = await cargarVistaAgenda(ctx("STAFF", { ...NIVELES_TODOS, cash: "VIEW" }), { rango: RANGO, habilitados: TODOS });
    expect(conCaja.capas).toContain("CUOTAS");
  });

  it("cumpleaños: si se llega al tope de perfiles leídos, la capa se marca como truncada", async () => {
    const perfil = (i: number) => ({ id: `pf${i}`, clientId: `cl${i}`, birthday: new Date("1990-01-01T00:00:00.000Z"), client: { firstName: "N", lastName: String(i), businessName: null } });
    P.fotofficeContactoPerfil.findMany.mockResolvedValue(Array.from({ length: 5000 }, (_, i) => perfil(i)));
    const lleno = await cargarVistaAgenda(DUENO, { rango: RANGO, habilitados: TODOS });
    expect(lleno.truncadas).toContain("CUMPLEANOS");
    P.fotofficeContactoPerfil.findMany.mockResolvedValue(Array.from({ length: 4999 }, (_, i) => perfil(i)));
    expect((await cargarVistaAgenda(DUENO, { rango: RANGO, habilitados: TODOS })).truncadas).not.toContain("CUMPLEANOS");
  });

  it("cuotas: las pagas no cuentan para el tope, así que muchas pagas no tapan a la impaga", async () => {
    const pedido = { number: "PED-1", status: "CONFIRMADO", totalArs: "60100", client: { firstName: "Laura", lastName: "Pérez", businessName: null } };
    const pagas = Array.from({ length: 600 }, (_, i) => ({ id: `p${i}`, pedidoId: "ped1", dueDate: new Date("2026-10-25T00:00:00.000Z"), pedido }));
    const impaga = { id: "impaga", pedidoId: "ped1", dueDate: new Date("2026-10-26T00:00:00.000Z"), pedido };
    P.fotofficePedidoCuota.findMany.mockImplementation(async (args: unknown) => {
      if ((args as { select: Record<string, unknown> }).select.pedido) return [...pagas, impaga];
      return [
        ...pagas.map((c, i) => ({ id: c.id, pedidoId: "ped1", position: i + 1, dueDate: c.dueDate, amountArs: "100", suggestedMethod: null })),
        { id: "impaga", pedidoId: "ped1", position: 601, dueDate: impaga.dueDate, amountArs: "100", suggestedMethod: null },
      ];
    });
    P.fotofficeCobroImputacion.findMany.mockResolvedValue(pagas.map((c, i) => ({ cobroId: `co${i}`, cuotaId: c.id, amountArs: "100" })));
    P.fotofficeCobro.findMany.mockResolvedValue(pagas.map((_, i) => ({ id: `co${i}`, voidedAt: null })));
    const v = await cargarVistaAgenda(DUENO, { rango: RANGO, habilitados: TODOS });
    expect(v.eventos.filter((e) => e.capa === "CUOTAS")).toHaveLength(1);
    expect(v.truncadas).not.toContain("CUOTAS");
  });

  it("sin Gestionar en Agenda las citas llegan de sólo lectura", async () => {
    const v = await cargarVistaAgenda(ctx("STAFF", { ...NIVELES_TODOS, agenda: "VIEW" }), { rango: RANGO, habilitados: TODOS });
    expect(v.eventos.filter((e) => e.capa === "CITAS").every((e) => !e.editable)).toBe(true);
  });

  it("los nombres de otros módulos no salen sin Ver ahí", async () => {
    const v = await cargarVistaAgenda(ctx("STAFF", { ...NIVELES_TODOS, projects: "NONE", clients: "NONE" }), { rango: RANGO, habilitados: TODOS });
    expect(v.citas[0]).toMatchObject({ clientNombre: null, origen: [{ tipo: "proyecto", etiqueta: "Proyecto", href: null }] });
  });

  it("toda lectura lleva el workspace, el rango y un tope", async () => {
    await cargarVistaAgenda(DUENO, { rango: RANGO, habilitados: TODOS, ownerUserId: 7 });
    for (const fn of [P.fotofficeCita.findMany, P.fotofficeProyecto.findMany, P.fotofficeTask.findMany, P.fotofficePedidoCuota.findMany, P.booking.findMany]) {
      const args = fn.mock.calls[0]![0] as { where: Record<string, unknown>; take?: number };
      expect(args.where.workspaceId).toBe("ws-1");
      // Las cuotas leen más: el tope se aplica después de sacar las pagas.
      expect(args.take).toBe(fn === P.fotofficePedidoCuota.findMany ? 2001 : 501);
    }
    expect((P.fotofficeCita.findMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where).toMatchObject({ ownerUserId: 7, startAt: { lt: RANGO.hasta }, endAt: { gt: RANGO.desde } });
  });

  it("si una capa pasa el tope se corta y se avisa", async () => {
    P.booking.findMany.mockResolvedValue(
      Array.from({ length: 501 }, (_, i) => ({ id: `b${i}`, startAt: new Date("2026-10-16T13:00:00.000Z"), endAt: new Date("2026-10-16T14:00:00.000Z"), contactName: "X", space: { name: "E" } })),
    );
    const v = await cargarVistaAgenda(DUENO, { rango: RANGO, habilitados: TODOS });
    expect(v.truncadas).toEqual(["RESERVAS"]);
    expect(v.eventos.filter((e) => e.capa === "RESERVAS")).toHaveLength(500);
  });
});
