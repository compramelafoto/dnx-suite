import { beforeEach, describe, expect, it, vi } from "vitest";

type Inv = { id: string; clientId: string; proyectoId: string; canal: string | null; clave: string | null };
type Recorrido = { subjectId: string; closedAt: Date };

const { estado, db, leerAjustes, contextoDe, crearInvitacion, textosDelCorreo, enviarCorreo } = vi.hoisted(() => {
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
      // Sólo las que salieron (canal no nulo), como pide la consulta real.
      findMany: vi.fn(async ({ where }: { where: { proyectoId: { in: string[] }; canal: { not: null } } }) =>
        estado.invitaciones.filter((i) => where.proyectoId.in.includes(i.proyectoId) && where.canal.not === null && i.canal !== null),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string }; data: { canal: string } }) => {
        for (const i of estado.invitaciones) if (i.id === where.id) i.canal = data.canal;
        return { count: 1 };
      }),
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        estado.invitaciones = estado.invitaciones.filter((i) => i.id !== where.id);
        return { count: 1 };
      }),
    },
  };
  return {
    estado,
    db,
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
vi.mock("@/lib/plantillas/envio", async (original) => ({ ...(await original<typeof import("@/lib/plantillas/envio")>()), enviarCorreo }));

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
  crearInvitacion.mockImplementation(async (_w: string, o: { clientId: string; proyectoId: string; canal?: string | null; claveIdempotencia?: string }) => {
    const id = `inv-${estado.siguiente++}`;
    estado.invitaciones.push({ id, clientId: o.clientId, proyectoId: o.proyectoId, canal: o.canal ?? null, clave: o.claveIdempotencia ?? null });
    return { invitacionId: id, enlace: `https://x/testimonio?t=${"A".repeat(43)}` };
  });
  enviarCorreo.mockResolvedValue({ ok: true, mensajeId: "m1" });
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

  it("sin organizaciones encendidas no hace nada", async () => {
    db.fotofficeTestimonioAjustes.findMany.mockResolvedValue([]);
    expect(await A.enviarPedidosAutomaticos({ ahora: () => AHORA })).toMatchObject({ organizaciones: 0, enviados: 0 });
  });
});
