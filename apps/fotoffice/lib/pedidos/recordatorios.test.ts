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
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
}));

const RC = await import("./recordatorios");
const EN = await import("./enlace");
const PL = await import("./plantillas");

/** 8 de octubre de 2026, 10:00 de Buenos Aires. */
const AHORA = new Date("2026-10-08T13:00:00.000Z");
const CLAVE = "clave-de-prueba";
const EMAIL = "laura@persona.test";
const deps = (ahora = AHORA) => ({ ahora: () => ahora, clave: CLAVE, appOrigin: "https://app.test" });
const dia = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const correo = (i = 0) => H.enviar.mock.calls[i]![0] as OutboundEmail;

function cuota(id: string, dueDate: string, amountArs = "30000.50", pedidoId = "ped-1") {
  return B.agregar("fotofficePedidoCuota", { id, workspaceId: "ws-1", pedidoId, position: 1, dueDate: dia(dueDate), amountArs });
}

function cobrar(cuotaId: string, importe: string, anulado = false) {
  const id = `cob-${cuotaId}-${importe}`;
  B.agregar("fotofficeCobro", {
    id, workspaceId: "ws-1", pedidoId: "ped-1", clientId: "cli-1", paidAt: AHORA, method: "EFECTIVO", amountArs: importe,
    receiptNumber: `R-${id}`, receiptTokenHash: `h-${id}`, voidedAt: anulado ? AHORA : null,
  });
  B.agregar("fotofficeCobroImputacion", { id: `imp-${id}`, workspaceId: "ws-1", cobroId: id, cuotaId, amountArs: importe });
}

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.enviar.mockReset();
  H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_1" });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null, email: EMAIL });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "orders", enabled: true });
  B.agregar("fotofficePedidoAjustes", { id: "aj-1", workspaceId: "ws-1", reminderDays: 1, reminderEnabled: true });
  B.agregar("fotofficePedido", { id: "ped-1", workspaceId: "ws-1", number: "2026-0001", clientId: "cli-1", items: [], totals: {}, totalArs: "60001.00" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  const log = JSON.stringify([...errores.mock.calls, ...avisos.mock.calls]);
  expect(log).not.toContain(EMAIL);
  expect(log).not.toContain("Laura");
  vi.restoreAllMocks();
});

describe("ventana de días (hora de Argentina)", () => {
  it("de hoy a hoy + días, los dos incluidos", () => {
    expect(RC.ventanaDeRecordatorio(AHORA, 1)).toEqual({ desde: "2026-10-08", hasta: "2026-10-09" });
    expect(RC.ventanaDeRecordatorio(AHORA, 0)).toEqual({ desde: "2026-10-08", hasta: "2026-10-08" });
    expect(RC.ventanaDeRecordatorio(new Date("2026-10-30T15:00:00Z"), 3)).toEqual({ desde: "2026-10-30", hasta: "2026-11-02" });
  });

  it("a las 23:30 de Argentina todavía es hoy, aunque en UTC ya sea mañana", () => {
    expect(RC.ventanaDeRecordatorio(new Date("2026-10-09T02:30:00.000Z"), 1)).toEqual({ desde: "2026-10-08", hasta: "2026-10-09" });
  });
});

describe("recordatorio de cuotas", () => {
  it("manda el recordatorio de la cuota que vence mañana, con vencimiento, saldo y enlace; queda registrado en el pedido", async () => {
    cuota("c1", "2026-10-09");
    const r = await RC.enviarRecordatoriosDeCuotas(deps());
    expect(r).toEqual({ organizaciones: 1, enviados: 1, fallidos: 0, salteados: 0, conTopeDiario: 0, topeCorrida: false });
    const m = correo();
    expect(m.to).toBe(EMAIL);
    expect(m.subject).toBe("Recordatorio: vence una cuota de tu pedido N° 2026-0001");
    expect(m.text).toContain("Hola, Laura:");
    expect(m.text).toMatch(/el 09\/10\/2026 vence la cuota de \$\s?30\.000,50 de tu pedido N° 2026-0001/);
    expect(m.text).toContain(`https://app.test/w/dnxestudio/pedido/${EN.tokenDelPedido("ped-1", CLAVE, 0)}`);
    expect(B.datos.fotofficeMessage).toHaveLength(1);
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ entityType: "PEDIDO", entityId: "ped-1", status: "SENT", automatic: true, errorCode: null });
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(1);
    expect(B.datos.fotofficeCuotaRecordatorio[0]).toMatchObject({ workspaceId: "ws-1", cuotaId: "c1", dueDate: dia("2026-10-09") });
    const plantilla = B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "RECORDATORIO_CUOTA")!;
    expect(plantilla).toMatchObject({ enabled: true, entityType: "PEDIDO", channel: "EMAIL" });
  });

  it("el importe es el saldo de la cuota: los cobros anulados no cuentan", async () => {
    cuota("c1", "2026-10-08", "30000.00");
    cobrar("c1", "10000.00");
    cobrar("c1", "5000.00", true);
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(1);
    expect(correo().text).toMatch(/vence la cuota de \$\s?20\.000,00/);
  });

  it("sólo las cuotas dentro de la ventana: ni las vencidas ni las que vencen después", async () => {
    cuota("ayer", "2026-10-07");
    cuota("hoy", "2026-10-08");
    cuota("manana", "2026-10-09");
    cuota("pasado", "2026-10-10");
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(2);
    expect(B.datos.fotofficeCuotaRecordatorio.map((x) => x.cuotaId).sort()).toEqual(["hoy", "manana"]);
    B.datos.fotofficePedidoAjustes[0]!.reminderDays = 2;
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(1);
    expect(B.datos.fotofficeCuotaRecordatorio.map((x) => x.cuotaId).sort()).toEqual(["hoy", "manana", "pasado"]);
  });

  it("de noche (UTC del día siguiente) usa el día de Argentina", async () => {
    cuota("c1", "2026-10-10");
    // 9 de octubre 00:30 UTC = 8 de octubre 21:30 en Argentina: con 1 día, el 10 todavía no entra.
    expect((await RC.enviarRecordatoriosDeCuotas(deps(new Date("2026-10-09T00:30:00.000Z")))).enviados).toBe(0);
    expect((await RC.enviarRecordatoriosDeCuotas(deps(new Date("2026-10-09T03:30:00.000Z")))).enviados).toBe(1);
  });

  it("una vez por cuota y vencimiento; si se mueve el vencimiento, vuelve a avisar", async () => {
    cuota("c1", "2026-10-09");
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(1);
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(0);
    expect(H.enviar).toHaveBeenCalledTimes(1);
    B.datos.fotofficePedidoCuota[0]!.dueDate = dia("2026-10-08");
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(1);
    expect(H.enviar).toHaveBeenCalledTimes(2);
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(2);
  });

  it("otra corrida que ya reservó la cuota la frena (el único de cuota y vencimiento)", async () => {
    cuota("c1", "2026-10-09");
    const original = B.tablas.fotofficeCuotaRecordatorio!.findMany;
    // Lee la base antes de que la otra corrida inserte su reserva.
    B.tablas.fotofficeCuotaRecordatorio!.findMany = async (a) => {
      const r = await original(a);
      B.agregar("fotofficeCuotaRecordatorio", { id: "otra", workspaceId: "ws-1", cuotaId: "c1", dueDate: dia("2026-10-09") });
      return r;
    };
    const r = await RC.enviarRecordatoriosDeCuotas(deps());
    B.tablas.fotofficeCuotaRecordatorio!.findMany = original;
    expect(r).toMatchObject({ enviados: 0, salteados: 1 });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeMessage).toHaveLength(0);
  });

  it("no avisa con el pedido cancelado, la cuota pagada, el recordatorio apagado, el módulo apagado o la plantilla apagada", async () => {
    cuota("c1", "2026-10-09", "10000.00");
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(0);
    B.datos.fotofficePedido[0]!.status = "CONFIRMADO";

    cobrar("c1", "10000.00");
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(0);
    B.datos.fotofficeCobroImputacion = [];

    B.datos.fotofficePedidoAjustes[0]!.reminderEnabled = false;
    expect(await RC.enviarRecordatoriosDeCuotas(deps())).toMatchObject({ organizaciones: 0, enviados: 0 });
    B.datos.fotofficePedidoAjustes[0]!.reminderEnabled = true;

    B.datos.workspaceFeatureModule[0]!.enabled = false;
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(0);
    B.datos.workspaceFeatureModule[0]!.enabled = true;

    await PL.asegurarPlantillaRecordatorio("ws-1");
    B.datos.fotofficeMessageTemplate.find((t) => t.systemKey === "RECORDATORIO_CUOTA")!.enabled = false;
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(0);

    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(0);
  });

  it("sin fila de ajustes no avisa ni la crea (aunque sea DNX)", async () => {
    B.datos.fotofficePedidoAjustes = [];
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnxestudio" });
    cuota("c1", "2026-10-09");
    expect(await RC.enviarRecordatoriosDeCuotas(deps())).toMatchObject({ organizaciones: 0, enviados: 0 });
    expect(B.datos.fotofficePedidoAjustes).toHaveLength(0);
  });

  it("sin correo se saltea y no marca la cuota", async () => {
    B.datos.client[0]!.email = null;
    cuota("c1", "2026-10-09");
    expect(await RC.enviarRecordatoriosDeCuotas(deps())).toMatchObject({ enviados: 0, salteados: 1 });
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(0);
  });

  it("no lo frena la regla de 24 h por dirección: es transaccional, como el recibo", async () => {
    B.agregar("fotofficeMessage", {
      id: "m-previo", workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "cli-1", toAddress: EMAIL, body: "x",
      status: "SENT", automatic: true, createdAt: new Date(AHORA.getTime() - 60_000),
    });
    cuota("c1", "2026-10-09");
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(1);
  });

  it("tope por corrida: como mucho `tope` intentos y avisa que quedaron", async () => {
    cuota("c1", "2026-10-08");
    cuota("c2", "2026-10-09");
    const r = await RC.enviarRecordatoriosDeCuotas({ ...deps(), tope: 1 });
    expect(r).toMatchObject({ enviados: 1, topeCorrida: true });
    expect(RC.TOPE_RECORDATORIOS_CORRIDA).toBe(200);
    // Al día siguiente sale la que quedó.
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(1);
  });

  it("tope diario de automáticos: corta la organización y libera la cuota para mañana", async () => {
    for (let i = 0; i < 50; i++) {
      B.agregar("fotofficeMessage", {
        id: `auto-${i}`, workspaceId: "ws-1", channel: "EMAIL", entityType: "CONSULTA", entityId: "x", toAddress: `p${i}@x.test`, body: "x",
        status: "SENT", automatic: true, createdAt: new Date(AHORA.getTime() - 60_000),
      });
    }
    cuota("c1", "2026-10-09");
    cuota("c2", "2026-10-09");
    const r = await RC.enviarRecordatoriosDeCuotas(deps());
    expect(r).toMatchObject({ enviados: 0, conTopeDiario: 1 });
    expect(H.enviar).not.toHaveBeenCalled();
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(0);
    expect(B.datos.fotofficeMessage.filter((m) => m.errorCode === "EN_CURSO")).toHaveLength(0);
  });

  it("si el proveedor falla, queda registrado y la cuota se vuelve a intentar al día siguiente", async () => {
    cuota("c1", "2026-10-09");
    H.enviar.mockResolvedValue({ status: "PROVIDER_REJECTED", detail: "HTTP 422" });
    expect(await RC.enviarRecordatoriosDeCuotas(deps())).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(B.datos.fotofficeMessage[0]).toMatchObject({ status: "FAILED", entityType: "PEDIDO" });
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(0);
    H.enviar.mockRejectedValue(new Error("caído"));
    expect(await RC.enviarRecordatoriosDeCuotas(deps())).toMatchObject({ enviados: 0 });
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(0);
    expect(B.datos.fotofficeMessage.filter((m) => m.errorCode === "EN_CURSO")).toHaveLength(0);
    H.enviar.mockResolvedValue({ status: "SENT", providerId: "re_2" });
    expect((await RC.enviarRecordatoriosDeCuotas(deps())).enviados).toBe(1);
  });

  it("con la plantilla rota corta la organización sin marcar nada", async () => {
    await PL.asegurarPlantillaRecordatorio("ws-1");
    B.datos.fotofficeMessageTemplate[0]!.body = "Hola [variable_que_no_existe]";
    cuota("c1", "2026-10-09");
    expect(await RC.enviarRecordatoriosDeCuotas(deps())).toMatchObject({ enviados: 0, fallidos: 1 });
    expect(B.datos.fotofficeCuotaRecordatorio).toHaveLength(0);
  });
});
