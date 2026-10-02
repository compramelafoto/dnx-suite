import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
const H = vi.hoisted(() => ({ encendidos: new Set<string>() }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async (_ws: string, clave: string) => H.encendidos.has(clave) }));

const { proveedorMensajes } = await import("./mensajes");
const { mensajesDeConsulta, MENSAJES_EN_HISTORIAL } = await import("@/lib/plantillas/registro");
const { CLIENTS_MODULE_KEY } = await import("@/lib/clients/constants");
const { MEMBERS_MODULE_KEY } = await import("@/lib/members/constants");
const { armarLinea } = await import("../linea-de-tiempo");

const T = (min: number) => new Date(Date.UTC(2026, 9, 1, 12, min));
const WS = { workspaceId: "ws-1" };

function mensaje(id: string, extra: Record<string, unknown>) {
  B.agregar("fotofficeMessage", {
    id, workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: null,
    toAddress: "ana@ejemplo.com", subject: "Hola", body: "Texto", status: "SENT", automatic: false,
    providerId: null, errorCode: null, actorUserId: 1, actorLabel: "Daniel", createdAt: T(0), ...extra,
  });
}

beforeEach(() => {
  H.encendidos = new Set([CLIENTS_MODULE_KEY, MEMBERS_MODULE_KEY]);
  B.vaciar();
  B.agregar("fotofficeMessageTemplate", { id: "p1", workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", name: "Gracias", body: "x" });
  B.agregar("fotofficeMessageTemplate", { id: "p-ajena", workspaceId: "ws-2", channel: "EMAIL", entityType: "CLIENTE", name: "Secreta", body: "x" });
  mensaje("a1", { templateId: "p1", createdAt: T(1) });
  mensaje("a2", {
    entityType: "SOCIO", entityId: "m1", channel: "WHATSAPP", subject: null, status: "OPENED_WHATSAPP", toAddress: "5493410000000",
    createdAt: T(2),
  });
  mensaje("a3", { status: "FAILED", errorCode: "PROVIDER_REJECTED:422", createdAt: T(3) });
  // Ruido: otra persona, otro tipo con el mismo id, otro workspace con el mismo id, una consulta.
  mensaje("b1", { entityId: "c2", createdAt: T(4) });
  mensaje("b2", { entityType: "SOCIO", entityId: "c1", createdAt: T(5) });
  mensaje("b3", { workspaceId: "ws-2", body: "secreto", templateId: "p-ajena", createdAt: T(6) });
  mensaje("b4", { entityType: "CONSULTA", entityId: "c1", createdAt: T(7) });
});

describe("proveedor mensajes — correos y WhatsApp en la línea de tiempo", () => {
  it("es de tipo mensajes", () => {
    expect(proveedorMensajes.clave).toBe("mensajes");
    expect(proveedorMensajes.tipo).toBe("mensajes");
  });

  it("sólo los del cliente y del socio de la persona, en su workspace, con estado legible", async () => {
    const ev = await proveedorMensajes.traer(WS, { clientId: "c1", memberId: "m1" }, null, 10);
    expect(ev.map((e) => e.id)).toEqual(["mensajes:a3", "mensajes:a2", "mensajes:a1"]);
    expect(ev[2]).toMatchObject({
      tipo: "mensajes",
      actor: "Daniel",
      titulo: "Correo enviado",
      mensaje: { canal: "EMAIL", estado: "Enviado", plantilla: "Gracias", asunto: "Hola", cuerpo: "Texto", automatico: false },
    });
    expect(ev[1]).toMatchObject({ titulo: "WhatsApp abierto", mensaje: { canal: "WHATSAPP", estado: "Abierto en WhatsApp", asunto: null } });
    expect(ev[0]).toMatchObject({ titulo: "Correo que falló", mensaje: { fallo: true, estado: "Falló: el proveedor de correo lo rechazó" } });
    expect(JSON.stringify(ev)).not.toContain("secreto");
    expect(JSON.stringify(ev)).not.toContain("Secreta");
  });

  it("los automáticos se marcan y no muestran a nadie como autor", async () => {
    mensaje("a4", { automatic: true, actorUserId: null, actorLabel: "Automático", createdAt: T(9) });
    const [ev] = await proveedorMensajes.traer(WS, { clientId: "c1", memberId: null }, null, 1);
    expect(ev).toMatchObject({ actor: "Automático", mensaje: { automatico: true } });
  });

  it("sólo cliente o sólo socio: lee el lado que hay", async () => {
    expect((await proveedorMensajes.traer(WS, { clientId: "c1", memberId: null }, null, 10)).map((e) => e.id)).toEqual([
      "mensajes:a3", "mensajes:a1",
    ]);
    expect((await proveedorMensajes.traer(WS, { clientId: null, memberId: "m1" }, null, 10)).map((e) => e.id)).toEqual(["mensajes:a2"]);
    expect(await proveedorMensajes.traer(WS, { clientId: null, memberId: null }, null, 10)).toEqual([]);
  });

  it("cada lado sólo con su módulo encendido", async () => {
    const persona = { clientId: "c1", memberId: "m1" };
    H.encendidos = new Set([CLIENTS_MODULE_KEY]);
    expect((await proveedorMensajes.traer(WS, persona, null, 10)).map((e) => e.id)).toEqual(["mensajes:a3", "mensajes:a1"]);
    H.encendidos = new Set([MEMBERS_MODULE_KEY]);
    expect((await proveedorMensajes.traer(WS, persona, null, 10)).map((e) => e.id)).toEqual(["mensajes:a2"]);
    H.encendidos = new Set();
    expect(await proveedorMensajes.traer(WS, persona, null, 10)).toEqual([]);
  });

  it("otro workspace no ve nada aunque coincidan los ids", async () => {
    expect(await proveedorMensajes.traer({ workspaceId: "ws-3" }, { clientId: "c1", memberId: "m1" }, null, 10)).toEqual([]);
  });

  it("el nombre de una plantilla de otro workspace nunca se usa", async () => {
    mensaje("a5", { templateId: "p-ajena", createdAt: T(10) });
    const [ev] = await proveedorMensajes.traer(WS, { clientId: "c1", memberId: null }, null, 1);
    expect(ev!.mensaje!.plantilla).toBeNull();
  });

  it("pagina con el cursor de la línea sin repetir ni perder filas de la misma fecha", async () => {
    mensaje("a6", { createdAt: T(10) });
    mensaje("a7", { createdAt: T(10) });
    mensaje("a8", { createdAt: T(10) });
    const persona = { clientId: "c1", memberId: "m1" };
    const ctx = { workspaceId: "ws-1", role: "STAFF" };
    const vistos: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 10; i++) {
      const p = await armarLinea({ proveedores: [proveedorMensajes], ctx, persona, filtro: null, cursor, take: 2 });
      vistos.push(...p.eventos.map((e) => e.id));
      cursor = p.siguiente;
      if (!cursor) break;
    }
    expect(vistos).toEqual(["mensajes:a8", "mensajes:a7", "mensajes:a6", "mensajes:a3", "mensajes:a2", "mensajes:a1"]);
  });

  it("el filtro «Mensajes» de la línea trae sólo mensajes", async () => {
    const p = await armarLinea({
      proveedores: [proveedorMensajes], ctx: { workspaceId: "ws-1", role: "STAFF" }, persona: { clientId: "c1", memberId: "m1" },
      filtro: "mensajes", cursor: null,
    });
    expect(p.eventos.every((e) => e.tipo === "mensajes")).toBe(true);
    expect(p.eventos).toHaveLength(3);
  });
});

describe("mensajesDeConsulta — historial de la consulta", () => {
  it("sólo los de esa consulta y ese workspace, el más nuevo primero", async () => {
    mensaje("c-1", { entityType: "CONSULTA", entityId: "q1", createdAt: T(1) });
    mensaje("c-2", { entityType: "CONSULTA", entityId: "q1", automatic: true, actorLabel: "Automático", createdAt: T(2) });
    mensaje("x-1", { entityType: "CLIENTE", entityId: "q1", createdAt: T(3) });
    mensaje("x-2", { workspaceId: "ws-2", entityType: "CONSULTA", entityId: "q1", createdAt: T(4) });
    const m = await mensajesDeConsulta("ws-1", "q1");
    expect(m.map((x) => x.id)).toEqual(["c-2", "c-1"]);
    expect(m[0]).toMatchObject({ automatico: true, quien: "Automático", estado: "Enviado" });
    expect(m[0]!.fecha).toBe(T(2).toISOString());
  });

  it(`con tope de ${MENSAJES_EN_HISTORIAL}`, async () => {
    for (let i = 0; i < MENSAJES_EN_HISTORIAL + 5; i++) {
      mensaje(`t-${String(i).padStart(3, "0")}`, { entityType: "CONSULTA", entityId: "q2", createdAt: T(i) });
    }
    const m = await mensajesDeConsulta("ws-1", "q2");
    expect(m).toHaveLength(MENSAJES_EN_HISTORIAL);
    expect(m[0]!.id).toBe(`t-${String(MENSAJES_EN_HISTORIAL + 4).padStart(3, "0")}`);
  });
});
