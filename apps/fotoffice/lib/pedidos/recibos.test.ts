import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail } from "@/lib/communications/send-email";

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
const EN = await import("./enlace");
const RE = await import("./recibos");
const PL = await import("./plantillas");

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const EMAIL = "laura@persona.test";
const deps = { ahora: () => AHORA, clave: CLAVE, appOrigin: "https://app.test" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

let n = 0;
async function cobro(importe = 40000) {
  const r = await CO.registrarCobro(DUENO, { pedidoId: "ped-1", importe, fecha: "2026-10-07", medio: "EFECTIVO", idempotencyKey: `clave-form-${++n}` }, deps);
  if (!r.ok) throw new Error(r.error);
  return r.cobroId;
}
const correo = (i = 0) => H.enviar.mock.calls[i]![0] as OutboundEmail;

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.enviar.mockReset();
  H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_1" });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null, email: EMAIL });
  B.agregar("cashAccount", { id: "caja", workspaceId: "ws-1", name: "Caja", kind: "EFECTIVO", isDefault: true });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  B.agregar("fotofficePedido", { id: "ped-1", workspaceId: "ws-1", number: "2026-0001", clientId: "cli-1", items: [], totals: {}, totalArs: "120000.00" });
  B.agregar("fotofficePedidoCuota", { id: "c1", workspaceId: "ws-1", pedidoId: "ped-1", position: 1, dueDate: new Date("2026-10-07T00:00:00Z"), amountArs: "120000.00" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  const log = JSON.stringify([...errores.mock.calls, ...avisos.mock.calls]);
  expect(log).not.toContain(EMAIL);
  expect(log).not.toContain("Laura");
  vi.restoreAllMocks();
});

describe("recibo de pago automático", () => {
  it("nace encendido y manda el recibo con su enlace, número, importe y saldo; queda registrado en el pedido", async () => {
    const id = await cobro(40000.5);
    expect(await RE.enviarReciboAutomatico("ws-1", id, deps)).toBe("ENVIADO");
    const m = correo();
    expect(m.to).toBe(EMAIL);
    expect(m.subject).toBe("Recibo de tu pago N° 2026-0001");
    const enlace = `https://app.test/w/dnxestudio/recibo/${EN.tokenDelRecibo(id, CLAVE)}`;
    expect(m.text).toContain(enlace);
    expect(m.text).toContain("Hola, Laura:");
    expect(m.text).toMatch(/de \$\s?40\.000,50 del pedido N° 2026-0001/);
    expect(m.text).toMatch(/Saldo pendiente del pedido: \$\s?80\.000/);
    const reg = B.datos.fotofficeMessage;
    expect(reg).toHaveLength(1);
    expect(reg[0]).toMatchObject({ entityType: "PEDIDO", entityId: "ped-1", status: "SENT", automatic: true, errorCode: null });
    const plantilla = B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "RECIBO_DE_PAGO")!;
    expect(plantilla).toMatchObject({ enabled: true, entityType: "PEDIDO", channel: "EMAIL" });
  });

  it("apagado, sin correo o con el cobro anulado no sale", async () => {
    await PL.asegurarPlantillaRecibo("ws-1");
    B.datos.fotofficeMessageTemplate[0]!.enabled = false;
    const id = await cobro();
    expect(await RE.enviarReciboAutomatico("ws-1", id, deps)).toBe("APAGADA");
    B.datos.fotofficeMessageTemplate[0]!.enabled = true;
    await CO.anularCobro(DUENO, id, "Error", deps);
    expect(await RE.enviarReciboAutomatico("ws-1", id, deps)).toBe("NO_ENCONTRADA");
    const otro = await cobro();
    B.datos.client[0]!.email = null;
    expect(await RE.enviarReciboAutomatico("ws-1", otro, deps)).toBe("SIN_CORREO");
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeMessage).toHaveLength(0);
  });

  it("dos cobros el mismo día: cada uno tiene su recibo (la regla de 24 h de las respuestas no lo frena)", async () => {
    expect(await RE.enviarReciboAutomatico("ws-1", await cobro(1000), deps)).toBe("ENVIADO");
    expect(await RE.enviarReciboAutomatico("ws-1", await cobro(1000), deps)).toBe("ENVIADO");
    expect(H.enviar).toHaveBeenCalledTimes(2);
  });

  it("si el texto usa [pedido_enlace], crea el enlace del pedido; si quitaron el del recibo, lo agrega", async () => {
    await PL.asegurarPlantillaRecibo("ws-1");
    B.datos.fotofficeMessageTemplate[0]!.body = "Tu pedido: [pedido_enlace]\n\n[firma]";
    const id = await cobro();
    expect(await RE.enviarReciboAutomatico("ws-1", id, deps)).toBe("ENVIADO");
    expect(correo().text).toContain(`/w/dnxestudio/pedido/${EN.tokenDelPedido("ped-1", CLAVE, 0)}`);
    expect(correo().text).toContain(`Podés ver el recibo acá: https://app.test/w/dnxestudio/recibo/`);
    expect(B.datos.fotofficePedido[0]!.accessTokenHash).toBe(EN.hashDeToken(EN.tokenDelPedido("ped-1", CLAVE, 0)));
  });

  it("una falla del proveedor queda registrada y nunca lanza", async () => {
    H.enviar.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422" });
    expect(await RE.enviarReciboAutomatico("ws-1", await cobro(), deps)).toBe("NO_ENVIADO");
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ status: "FAILED", entityType: "PEDIDO" });
    H.enviar.mockRejectedValue(new Error("caído"));
    expect(await RE.enviarReciboAutomatico("ws-1", await cobro(), deps)).toBe("ERROR");
    // La reserva de un envío que lanzó se libera.
    expect(B.datos.fotofficeMessage.filter((m) => m.errorCode === "EN_CURSO")).toHaveLength(0);
  });
});

describe("plantillas iniciales de pedidos", () => {
  it("'Tu pedido' sólo en DNX, una sola vez, con [pedido_enlace]", async () => {
    await PL.asegurarPlantillasPedido("ws-1", "otro-estudio");
    expect(B.datos.fotofficeMessageTemplate).toHaveLength(0);
    await PL.asegurarPlantillasPedido("ws-1", "dnxestudio");
    await PL.asegurarPlantillasPedido("ws-1", "dnxestudio");
    const tu = B.datos.fotofficeMessageTemplate.filter((t) => t.name === "Tu pedido");
    expect(tu.map((t) => t.channel).sort()).toEqual(["EMAIL", "WHATSAPP"]);
    for (const t of tu) expect(t).toMatchObject({ entityType: "PEDIDO", systemKey: null });
    for (const t of tu) expect(t.body).toContain("[pedido_enlace]");
  });
});
