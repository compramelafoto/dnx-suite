import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail } from "@/lib/communications/send-email";

/**
 * Task 6: "Enviar por correo" y "WhatsApp" desde la ficha del pedido y desde el recibo, con las
 * plantillas de tipo PEDIDO. El mensaje va al contacto del pedido y queda registrado en el pedido.
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  enviar: vi.fn(async (_m: unknown): Promise<unknown> => ({ status: "SENT", providerId: "re_1" })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "Estudio DNX",
    signature: { html: "<table>FIRMA</table>", text: "FIRMA" },
    contact: { email: "hola@estudio.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.enviar }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: async () => ({ movido: false }) }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
}));

const CO = await import("./cobros");
const EV = await import("./envio");
const EN = await import("./enlace");
const { MENSAJES_PEDIDO: M } = await import("./acceso");

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const EMAIL = "laura@persona.test";
const deps = { ahora: () => AHORA, clave: CLAVE, appOrigin: "https://app.test" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "VIEW" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

const correo = (i = 0) => H.enviar.mock.calls[i]![0] as OutboundEmail;
const mensajes = () => B.datos.fotofficeMessage;

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.enviar.mockReset();
  H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_1" });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null, email: EMAIL, phone: "+5493415551234" });
  B.agregar("cashAccount", { id: "caja", workspaceId: "ws-1", name: "Caja", kind: "EFECTIVO", isDefault: true });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  B.agregar("fotofficePedido", { id: "ped-1", workspaceId: "ws-1", number: "2026-0001", clientId: "cli-1", items: [], totals: {}, totalArs: "120000.00" });
  B.agregar("fotofficePedidoCuota", { id: "c1", workspaceId: "ws-1", pedidoId: "ped-1", position: 1, dueDate: new Date("2026-10-07T00:00:00Z"), amountArs: "120000.00" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|Pérez|laura@/);
  errores.mockRestore();
});

describe("enviar un mensaje del pedido", () => {
  it("correo: va al contacto del pedido con las variables completas y queda registrado en el pedido", async () => {
    const r = await EV.enviarMensajePedido(
      DUENO,
      "ped-1",
      { canal: "EMAIL", asunto: "Tu pedido N° [pedido_numero]", cuerpo: "Hola [nombre]: tu pedido [pedido_numero]. [pedido_enlace]" },
      deps,
    );
    expect(r).toEqual({ ok: true, whatsappUrl: null });
    expect(correo().to).toBe(EMAIL);
    expect(correo().subject).toBe("Tu pedido N° 2026-0001");
    expect(correo().text).toContain("Hola Laura: tu pedido 2026-0001.");
    expect(correo().text).toContain("https://app.test/w/dnxestudio/pedido/");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ entityType: "PEDIDO", entityId: "ped-1", channel: "EMAIL", status: "SENT", automatic: false });
  });

  it("con cobro: completa el recibo y agrega su enlace si el texto no lo trae", async () => {
    const c = await CO.registrarCobro(DUENO, { pedidoId: "ped-1", importe: 40000, fecha: "2026-10-07", medio: "EFECTIVO", idempotencyKey: "clave-form-1" }, deps);
    if (!c.ok) throw new Error(c.error);
    const r = await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "EMAIL", asunto: "Recibo [recibo_numero]", cuerpo: "Pagaste [recibo_importe]." }, deps);
    expect(r.ok).toBe(true);
    const sinCobro = correo().text;
    expect(sinCobro).not.toContain("/recibo/");
    H.enviar.mockClear();
    const r2 = await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "EMAIL", asunto: "Recibo [recibo_numero]", cuerpo: "Pagaste [recibo_importe].", cobroId: c.cobroId }, deps);
    expect(r2.ok).toBe(true);
    expect(correo().subject).toBe("Recibo 2026-0001");
    expect(correo().text).toMatch(/Pagaste \$\s40\.000,00\./);
    expect(correo().text).toContain(`https://app.test/w/dnxestudio/recibo/${EN.tokenDelRecibo(c.cobroId, CLAVE)}`);
  });

  it("WhatsApp: devuelve el enlace wa.me con el texto y lo registra en el pedido", async () => {
    const r = await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "WHATSAPP", cuerpo: "Hola [nombre], tu pedido: [pedido_enlace]" }, deps);
    if (!r.ok) throw new Error(r.error);
    expect(r.whatsappUrl).toMatch(/^https:\/\/wa\.me\/5493415551234\?text=/);
    expect(decodeURIComponent(r.whatsappUrl!)).toContain("Hola Laura, tu pedido: https://app.test/w/dnxestudio/pedido/");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(mensajes()[0]).toMatchObject({ entityType: "PEDIDO", entityId: "ped-1", channel: "WHATSAPP", status: "OPENED_WHATSAPP" });
  });

  it("plantillas: sólo PEDIDO o GENERAL del workspace", async () => {
    B.agregar("fotofficeMessageTemplate", { id: "pl-pedido", workspaceId: "ws-1", channel: "EMAIL", entityType: "PEDIDO", name: "Tu pedido", subject: "Pedido [pedido_numero]", body: "Hola [nombre]", systemKey: null, archivedAt: null });
    B.agregar("fotofficeMessageTemplate", { id: "pl-consulta", workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", name: "Otra", subject: "x", body: "y", systemKey: null, archivedAt: null });
    B.agregar("fotofficeMessageTemplate", { id: "pl-ajena", workspaceId: "ws-2", channel: "EMAIL", entityType: "PEDIDO", name: "Ajena", subject: "x", body: "y", systemKey: null, archivedAt: null });
    expect((await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "EMAIL", templateId: "pl-pedido" }, deps)).ok).toBe(true);
    expect(correo().subject).toBe("Pedido 2026-0001");
    expect(mensajes()[0]!.templateId).toBe("pl-pedido");
    for (const id of ["pl-consulta", "pl-ajena"]) {
      expect(await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "EMAIL", templateId: id }, deps)).toMatchObject({ ok: false });
    }
    expect(H.enviar).toHaveBeenCalledTimes(1);
  });

  it("permisos y aislamiento: sin Gestionar, de otro workspace o con un cobro ajeno no sale nada", async () => {
    expect(await EV.enviarMensajePedido(LECTOR, "ped-1", { canal: "EMAIL", asunto: "a", cuerpo: "b" }, deps)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await EV.enviarMensajePedido(OTRO, "ped-1", { canal: "EMAIL", asunto: "a", cuerpo: "b" }, deps)).toEqual({ ok: false, error: M.noExiste });
    expect(await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "EMAIL", asunto: "a", cuerpo: "b", cobroId: "cobro-ajeno" }, deps)).toMatchObject({ ok: false });
    expect(await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "FAX", cuerpo: "b" }, deps)).toEqual({ ok: false, error: EV.MENSAJES_MENSAJE_PEDIDO.canal });
    expect(await EV.enviarMensajePedido(DUENO, "ped-1", { canal: "EMAIL" }, deps)).toEqual({ ok: false, error: EV.MENSAJES_MENSAJE_PEDIDO.sinTexto });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });
});

describe("opciones de envío de la ficha", () => {
  it("plantillas PEDIDO y GENERAL de cada canal y si el contacto tiene correo y WhatsApp; sin Gestionar, null", async () => {
    B.agregar("fotofficeMessageTemplate", { id: "pl-1", workspaceId: "ws-1", channel: "WHATSAPP", entityType: "GENERAL", name: "Saludo", subject: null, body: "Hola", systemKey: null, archivedAt: null, order: 0 });
    const o = await EV.opcionesDeEnvioPedido(DUENO, "ped-1");
    expect(o?.destino).toEqual({ correo: true, whatsapp: true });
    expect(o?.plantillas.map((p) => [p.id, p.canal])).toEqual([["pl-1", "WHATSAPP"]]);
    expect(await EV.opcionesDeEnvioPedido(LECTOR, "ped-1")).toBeNull();
    expect(await EV.opcionesDeEnvioPedido(OTRO, "ped-1")).toBeNull();
  });
});
