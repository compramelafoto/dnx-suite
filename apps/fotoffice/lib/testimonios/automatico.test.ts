import { beforeEach, describe, expect, it, vi } from "vitest";

type Inv = { id: string; workspaceId?: string; clientId: string; proyectoId: string; canal: string | null; clave: string | null; enviadaAt?: Date };
type WhereInv = {
  workspaceId?: string | { in: string[] };
  proyectoId?: { in: string[] };
  clientId?: { in: string[] };
  canal?: { not: null } | null;
  enviadaAt?: { gte?: Date; lt?: Date };
  claveIdempotencia?: string | { startsWith: string };
  id?: string;
};
type Recorrido = { subjectId: string; closedAt: Date };

const { estado, db, leerAjustes, contextoDe, crearInvitacion, textosDelCorreo, enviarCorreo, enviadosHoy, modulo } = vi.hoisted(() => {
  const estado = {
    recorridos: [] as Recorrido[],
    proyectos: [] as { id: string; name: string; clientId: string; email: string | null }[],
    invitaciones: [] as Inv[],
    siguiente: 1,
  };
  const db = {
    fotofficeTestimonioAjustes: { findMany: vi.fn() },
    fotofficeJourney: {
      findMany: vi.fn(async ({ where }: { where: { closedAt: { gte: Date; lte: Date } } }) =>
        estado.recorridos
          .filter((r) => r.closedAt >= where.closedAt.gte && r.closedAt <= where.closedAt.lte)
          .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())
          .map((r) => ({ subjectId: r.subjectId })),
      ),
    },
    fotofficeProyecto: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        estado.proyectos.filter((p) => where.id.in.includes(p.id)).map((p) => ({ id: p.id, name: p.name, clientId: p.clientId, client: { email: p.email } })),
      ),
    },
    fotofficeTestimonioInvitacion: {
      findMany: vi.fn(async ({ where }: { where: WhereInv }) => estado.invitaciones.filter((i) => coincide(i, where))),
      findFirst: vi.fn(async ({ where }: { where: WhereInv }) => estado.invitaciones.find((i) => coincide(i, where)) ?? null),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: { canal: string } }) => {
        for (const i of estado.invitaciones) if (i.id === where.id) i.canal = data.canal;
        return { count: 1 };
      }),
      deleteMany: vi.fn(async ({ where }: { where: WhereInv }) => {
        const antes = estado.invitaciones.length;
        estado.invitaciones = estado.invitaciones.filter((i) => !coincide(i, where));
        return { count: antes - estado.invitaciones.length };
      }),
      groupBy: vi.fn(async ({ where }: { where: WhereInv }) => {
        const ultimo = new Map<string, Date>();
        for (const i of estado.invitaciones.filter((x) => coincide(x, where))) {
          const ws = i.workspaceId ?? "ws-1";
          const f = i.enviadaAt ?? new Date(0);
          if (!ultimo.has(ws) || ultimo.get(ws)! < f) ultimo.set(ws, f);
        }
        return [...ultimo].map(([workspaceId, f]) => ({ workspaceId, _max: { enviadaAt: f } }));
      }),
    },
  };
  // Lo que la consulta real filtraría (sólo los campos que usa el módulo).
  function coincide(i: Inv, w: WhereInv): boolean {
    const ws = i.workspaceId ?? "ws-1";
    if (typeof w.workspaceId === "string" && w.workspaceId !== ws) return false;
    if (w.workspaceId && typeof w.workspaceId === "object" && !w.workspaceId.in.includes(ws)) return false;
    if (w.id !== undefined && w.id !== i.id) return false;
    if (w.proyectoId && !w.proyectoId.in.includes(i.proyectoId)) return false;
    if (w.clientId && !w.clientId.in.includes(i.clientId)) return false;
    if (w.canal === null && i.canal !== null) return false;
    if (w.canal && i.canal === null) return false;
    if (typeof w.claveIdempotencia === "string" && w.claveIdempotencia !== i.clave) return false;
    if (w.claveIdempotencia && typeof w.claveIdempotencia === "object" && !(i.clave ?? "").startsWith(w.claveIdempotencia.startsWith)) return false;
    const f = i.enviadaAt ?? new Date(0);
    if (w.enviadaAt?.gte && f < w.enviadaAt.gte) return false;
    if (w.enviadaAt?.lt && !(f < w.enviadaAt.lt)) return false;
    return true;
  }
  return {
    estado,
    db,
    enviadosHoy: vi.fn(),
    modulo: vi.fn(),
    leerAjustes: vi.fn(),
    contextoDe: vi.fn(),
    crearInvitacion: vi.fn(),
    textosDelCorreo: vi.fn(),
    enviarCorreo: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("./ajustes", () => ({ leerAjustesTestimonios: leerAjustes }));
vi.mock("./invitaciones", async (original) => ({ ...(await original<typeof import("./invitaciones")>()), crearInvitacion }));
vi.mock("./pedido", async (original) => ({ ...(await original<typeof import("./pedido")>()), textosDelCorreo }));
vi.mock("@/lib/plantillas/contexto", async (original) => ({ ...(await original<typeof import("@/lib/plantillas/contexto")>()), contextoDe }));
vi.mock("@/lib/plantillas/envio", async (original) => ({
  ...(await original<typeof import("@/lib/plantillas/envio")>()),
  enviarCorreo,
  correosEnviadosHoy: enviadosHoy,
}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: modulo }));

const A = await import("./automatico");
const { MENSAJES_ENVIO } = await import("@/lib/plantillas/envio");

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-11-20T14:00:00Z");
const ENCENDIDO = new Date("2026-11-01T12:00:00Z");
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA);

function proyecto(n: number, cerradoHace: number, email: string | null = `c${n}@mail.com`) {
  estado.proyectos.push({ id: `p${n}`, name: `Trabajo ${n}`, clientId: `c${n}`, email });
  estado.recorridos.push({ subjectId: `p${n}`, closedAt: hace(cerradoHace) });
}

beforeEach(() => {
  vi.clearAllMocks();
  estado.recorridos = [];
  estado.proyectos = [];
  estado.invitaciones = [];
  estado.siguiente = 1;
  leerAjustes.mockResolvedValue({ automaticoEncendido: true, diasDespues: 7, encendidoAt: ENCENDIDO, avisarAlEquipo: true });
  db.fotofficeTestimonioAjustes.findMany.mockResolvedValue([{ workspaceId: "ws-1" }]);
  contextoDe.mockImplementation(async (_w: string, _t: string, id: string) => ({
    variables: { persona: { nombreCompleto: `Cliente ${id}` } },
    destino: { email: `${id}@mail.com`, telefono: null },
  }));
  textosDelCorreo.mockResolvedValue({ templateId: "tpl-1", asunto: "Hola", cuerpo: "Contanos: __ENLACE_TESTIMONIO_PERSONAL__" });
  crearInvitacion.mockImplementation(
    async (w: string, o: { clientId: string; proyectoId: string; canal?: string | null; claveIdempotencia?: string; ahora?: Date }) => {
      // La clave es única en la base.
      if (o.claveIdempotencia && estado.invitaciones.some((i) => i.clave === o.claveIdempotencia)) {
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }
      const id = `inv-${estado.siguiente++}`;
      estado.invitaciones.push({
        id, workspaceId: w, clientId: o.clientId, proyectoId: o.proyectoId, canal: o.canal ?? null, clave: o.claveIdempotencia ?? null, enviadaAt: o.ahora,
      });
      return { invitacionId: id, enlace: `https://x/testimonio?t=${"A".repeat(43)}` };
    },
  );
  enviarCorreo.mockResolvedValue({ ok: true, mensajeId: "m1" });
  enviadosHoy.mockResolvedValue(0);
  modulo.mockResolvedValue(true);
});

describe("candidatosParaInvitar", () => {
  it("apagado: ninguno (aunque haya proyectos terminados)", async () => {
    proyecto(1, 10);
    leerAjustes.mockResolvedValue({ automaticoEncendido: false, diasDespues: 7, encendidoAt: null, avisarAlEquipo: true });
    expect(await A.candidatosParaInvitar("ws-1", AHORA)).toEqual([]);
  });

  it("los terminados antes de encender quedan afuera; entra el de después y con los días cumplidos", async () => {
    proyecto(1, 25); // terminó el 26/10: antes de encender (1/11)
    proyecto(2, 15); // terminó el 5/11: sí
    proyecto(3, 3); // terminó hace 3 días: todavía no (faltan 7)
    const r = await A.candidatosParaInvitar("ws-1", AHORA);
    expect(r.map((c) => c.proyectoId)).toEqual(["p2"]);
  });

  it("sin correo o ya invitado (con canal): no; invitación cancelada a mano (canal null): sí", async () => {
    proyecto(1, 10, null);
    proyecto(2, 10);
    proyecto(3, 10);
    estado.invitaciones.push({ id: "i-ya", clientId: "c2", proyectoId: "p2", canal: "WHATSAPP", clave: null });
    estado.invitaciones.push({ id: "i-cancelada", clientId: "c3", proyectoId: "p3", canal: null, clave: null });
    const r = await A.candidatosParaInvitar("ws-1", AHORA);
    expect(r.map((c) => c.proyectoId)).toEqual(["p3"]);
  });

  it("tope de 30 por organización, los más viejos primero", async () => {
    for (let n = 1; n <= 45; n++) proyecto(n, 8 + (n % 10) * 0.5 + n / 1000);
    const r = await A.candidatosParaInvitar("ws-1", AHORA);
    expect(r).toHaveLength(30);
  });

  it("al cliente que recibió un pedido (de otro proyecto) en los últimos 30 días no se le pide", async () => {
    proyecto(1, 10);
    proyecto(2, 10);
    estado.invitaciones.push({ id: "i-reciente", clientId: "c1", proyectoId: "otro", canal: "EMAIL", clave: null, enviadaAt: hace(2) });
    estado.invitaciones.push({ id: "i-vieja", clientId: "c2", proyectoId: "otro2", canal: "EMAIL", clave: null, enviadaAt: hace(40) });
    estado.invitaciones.push({ id: "i-sin-salir", clientId: "c2", proyectoId: "otro3", canal: null, clave: null, enviadaAt: hace(1) });
    const r = await A.candidatosParaInvitar("ws-1", AHORA);
    expect(r.map((c) => c.proyectoId)).toEqual(["p2"]);
  });

  it("un cliente con dos proyectos terminados: uno por corrida, y el otro recién pasados los 30 días", async () => {
    proyecto(1, 12);
    estado.proyectos.push({ id: "p9", name: "Otro", clientId: "c1", email: "c1@mail.com" });
    estado.recorridos.push({ subjectId: "p9", closedAt: hace(11) });
    expect((await A.enviarPedidosAutomaticos({ ahora: () => AHORA })).enviados).toBe(1);
    expect((await A.enviarPedidosAutomaticos({ ahora: () => new Date(AHORA.getTime() + DIA) })).enviados).toBe(0);
  });

  it("un cliente con dos proyectos terminados: uno por corrida", async () => {
    proyecto(1, 12);
    estado.proyectos.push({ id: "p9", name: "Otro", clientId: "c1", email: "c1@mail.com" });
    estado.recorridos.push({ subjectId: "p9", closedAt: hace(11) });
    const r = await A.candidatosParaInvitar("ws-1", AHORA);
    expect(r.map((c) => c.proyectoId)).toEqual(["p1"]);
  });
});

describe("enviarPedidosAutomaticos", () => {
  it("manda uno por proyecto, automático, con la clave única, y el segundo día no repite", async () => {
    proyecto(1, 10);
    proyecto(2, 9);
    const dia1 = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(dia1).toMatchObject({ organizaciones: 1, enviados: 2, fallidos: 0 });
    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    const [, datos, , opciones] = enviarCorreo.mock.calls[0];
    expect(datos).toMatchObject({ entityType: "CLIENTE", entityId: "c1", templateId: "tpl-1", automatico: true });
    expect(datos.cuerpo).toContain("https://x/testimonio?t=");
    expect(datos.cuerpo).not.toContain("__ENLACE_TESTIMONIO_PERSONAL__");
    expect(opciones.tipoPlantilla).toBe("TESTIMONIO");
    expect(crearInvitacion).toHaveBeenCalledWith("ws-1", expect.objectContaining({ claveIdempotencia: "auto:c1:p1", proyectoId: "p1" }));
    expect(estado.invitaciones.every((i) => i.canal === "EMAIL")).toBe(true);

    enviarCorreo.mockClear();
    const dia2 = await A.enviarPedidosAutomaticos({ ahora: () => new Date(AHORA.getTime() + DIA) });
    expect(dia2.enviados).toBe(0);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("una invitación manual abierta y cancelada (sin canal) no frena al automático", async () => {
    proyecto(1, 10);
    estado.invitaciones.push({ id: "i-cancelada", clientId: "c1", proyectoId: "p1", canal: null, clave: null });
    expect((await A.enviarPedidosAutomaticos({ ahora: () => AHORA })).enviados).toBe(1);
  });

  it("tope de 30 por día: con 45 elegibles salen 30 y el resto queda para mañana", async () => {
    for (let n = 1; n <= 45; n++) proyecto(n, 10 + n / 1000);
    const dia1 = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(dia1.enviados).toBe(30);
    const dia2 = await A.enviarPedidosAutomaticos({ ahora: () => new Date(AHORA.getTime() + DIA) });
    expect(dia2.enviados).toBe(15);
  });

  it("si el correo no sale, se descarta la invitación y se reintenta mañana", async () => {
    proyecto(1, 10);
    enviarCorreo.mockResolvedValueOnce({ ok: false, error: MENSAJES_ENVIO.falloProveedor, registrado: true });
    const dia1 = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(dia1).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(estado.invitaciones).toEqual([]);
    expect((await A.enviarPedidosAutomaticos({ ahora: () => new Date(AHORA.getTime() + DIA) })).enviados).toBe(1);
  });

  it("al llegar al tope diario de automáticos corta la organización", async () => {
    proyecto(1, 10);
    proyecto(2, 10);
    enviarCorreo.mockResolvedValue({ ok: false, error: MENSAJES_ENVIO.topeAutomaticos });
    const r = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(r.conTopeDiario).toBe(1);
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect(estado.invitaciones).toEqual([]);
  });

  it("sin Sitio web o sin Clientes encendidos, la organización no recibe nada", async () => {
    proyecto(1, 10);
    modulo.mockImplementation(async (_w: string, clave: string) => clave !== "website");
    expect(await A.enviarPedidosAutomaticos({ ahora: () => AHORA })).toMatchObject({ organizaciones: 0, enviados: 0 });
    modulo.mockImplementation(async (_w: string, clave: string) => clave !== "clients");
    expect(await A.enviarPedidosAutomaticos({ ahora: () => AHORA })).toMatchObject({ organizaciones: 0, enviados: 0 });
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(crearInvitacion).not.toHaveBeenCalled();
  });

  it("deja lugar a los automáticos transaccionales: corta al llegar a tope menos la reserva", async () => {
    for (let n = 1; n <= 5; n++) proyecto(n, 10 + n / 1000);
    const { TOPE_AUTOMATICOS_DIA } = await import("@/lib/plantillas/constantes");
    const limite = TOPE_AUTOMATICOS_DIA - A.RESERVA_AUTOMATICOS_TRANSACCIONALES;
    expect(limite).toBe(20);
    let hoy = limite - 2;
    enviadosHoy.mockImplementation(async () => hoy);
    enviarCorreo.mockImplementation(async () => {
      hoy++;
      return { ok: true, mensajeId: "m" };
    });
    const r = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(r).toMatchObject({ enviados: 2, conTopeDiario: 1 });
    // La que cortó no deja invitación de más.
    expect(estado.invitaciones).toHaveLength(2);
    expect(enviadosHoy).toHaveBeenCalledWith("ws-1", AHORA, true);
  });

  it("corta a los 240 s y devuelve lo hecho; lo que faltó sale mañana", async () => {
    for (let n = 1; n <= 5; n++) proyecto(n, 10 + n / 1000);
    let ms = 0;
    enviarCorreo.mockImplementation(async () => {
      ms += 100_000; // cada envío «tarda» 100 s
      return { ok: true, mensajeId: "m" };
    });
    const r = await A.enviarPedidosAutomaticos({ ahora: () => AHORA, reloj: () => ms });
    expect(r).toMatchObject({ enviados: 3, cortadaPorTiempo: true });
    const otra = await A.enviarPedidosAutomaticos({ ahora: () => new Date(AHORA.getTime() + DIA), reloj: () => 0 });
    expect(otra).toMatchObject({ enviados: 2, cortadaPorTiempo: false });
  });

  it("empieza por la organización a la que hace más que no le sale un pedido automático", async () => {
    db.fotofficeTestimonioAjustes.findMany.mockResolvedValue([{ workspaceId: "ws-a" }, { workspaceId: "ws-b" }, { workspaceId: "ws-c" }]);
    estado.invitaciones.push(
      { id: "x1", workspaceId: "ws-a", clientId: "z1", proyectoId: "z1", canal: "EMAIL", clave: "auto:z1:z1", enviadaAt: hace(1) },
      { id: "x2", workspaceId: "ws-b", clientId: "z2", proyectoId: "z2", canal: "EMAIL", clave: "auto:z2:z2", enviadaAt: hace(5) },
    );
    const orden: string[] = [];
    leerAjustes.mockImplementation(async (w: string) => {
      orden.push(w);
      return { automaticoEncendido: false, diasDespues: 7, encendidoAt: null, avisarAlEquipo: true };
    });
    await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(orden).toEqual(["ws-c", "ws-b", "ws-a"]);
  });

  it("una invitación colgada (con clave, sin canal, de hace más de una hora) se libera y se reintenta", async () => {
    proyecto(1, 10);
    estado.invitaciones.push({ id: "colgada", clientId: "c1", proyectoId: "p1", canal: null, clave: "auto:c1:p1", enviadaAt: hace(1) });
    const r = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(r).toMatchObject({ enviados: 1, salteados: 0 });
    expect(crearInvitacion).toHaveBeenCalledTimes(2);
    expect(estado.invitaciones.map((i) => i.id)).not.toContain("colgada");
    expect(estado.invitaciones).toHaveLength(1);
    expect(estado.invitaciones[0]!.canal).toBe("EMAIL");
  });

  it("una reserva reciente (otra corrida en curso) no se toca", async () => {
    proyecto(1, 10);
    estado.invitaciones.push({ id: "en-curso", clientId: "c1", proyectoId: "p1", canal: null, clave: "auto:c1:p1", enviadaAt: new Date(AHORA.getTime() - 5 * 60_000) });
    const r = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(r).toMatchObject({ enviados: 0, salteados: 1 });
    expect(enviarCorreo).not.toHaveBeenCalled();
    expect(estado.invitaciones.map((i) => i.id)).toEqual(["en-curso"]);
  });

  it("una plantilla sin el enlace no se manda", async () => {
    proyecto(1, 10);
    textosDelCorreo.mockResolvedValue({ templateId: "tpl-1", asunto: "Hola", cuerpo: "Contanos cómo te fue" });
    const r = await A.enviarPedidosAutomaticos({ ahora: () => AHORA });
    expect(r).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(crearInvitacion).not.toHaveBeenCalled();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("sin organizaciones encendidas no hace nada", async () => {
    db.fotofficeTestimonioAjustes.findMany.mockResolvedValue([]);
    expect(await A.enviarPedidosAutomaticos({ ahora: () => AHORA })).toMatchObject({ organizaciones: 0, enviados: 0 });
  });
});
