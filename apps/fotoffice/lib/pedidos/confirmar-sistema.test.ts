import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("./confirmar");
const { MENSAJES_PEDIDO: M } = await import("./acceso");
const { buildPaymentOptionsSnapshot, conCondicionesCobro, SUFIJO_TRANSFERENCIA } = await import("./opciones-pago");
const { condicionesDeCobro } = await import("@/lib/presupuestos/cobro");
const { INITIAL_CUANTO_COBRO_PRICING_EXTRAS } = await import("@repo/cuanto-cobro-core");

// 12:00 en Buenos Aires: hoy es 2026-10-15.
const AHORA = new Date("2026-10-15T15:00:00.000Z");
const deps = { ahora: () => AHORA };
const OPCIONES = {
  cashEnabled: true,
  cashDiscountPercent: "",
  cashCommercialNote: "",
  installmentPlans: [{ id: "p3", numberOfInstallments: "3", interestMode: "none" as const, interestPercent: "", commercialNote: "" }],
};

function aceptado(elegida: string, conCobro: boolean) {
  B.agregar("serviceSalesLead", { id: "lead-1", workspaceId: "ws-1", name: "Laura Pérez", email: "laura@persona.test", eventType: "BODA" });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-1", workspaceId: "ws-1", name: "Boda", group: "BODA" });
  B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "lead-1", clientId: "cli-1", categoryId: "cat-1", eventStartsAt: new Date("2027-03-20T00:00:00.000Z") });
  const total = 1_000_000;
  const snap = buildPaymentOptionsSnapshot({ basePrice: total, paymentOptions: OPCIONES, calculatedAt: AHORA.toISOString() });
  const cobro = conCobro ? condicionesDeCobro({ ...INITIAL_CUANTO_COBRO_PRICING_EXTRAS, depositPercent: "30", paymentCommissionPercent: "6" }, total) : null;
  B.agregar("fotofficePresupuestoVersion", {
    id: "v-1", workspaceId: "ws-1", presupuestoId: "pre-1", number: 1, items: [],
    totals: { subtotal: total, descuentoItems: 0, descuentoGlobal: 0, iva: 0, total, opcionales: { cantidad: 0, total: 0 }, secciones: [], renglones: {}, descuento: null },
    paymentOptions: conCondicionesCobro(snap, cobro),
    chosenPaymentOptionId: elegida, sentAt: AHORA, acceptedAt: AHORA,
  });
  B.agregar("fotofficePresupuesto", {
    id: "pre-1", workspaceId: "ws-1", consultaLeadId: "lead-1", clientId: "cli-1", status: "ACEPTADO",
    currentVersionId: "v-1", acceptedVersionId: "v-1", ownerUserId: 7, pedidoPorConfirmar: true,
  });
}

const cuotas = () =>
  B.datos.fotofficePedidoCuota
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((c) => [(c.dueDate as Date).toISOString().slice(0, 10), Number(c.amountArs), c.suggestedMethod ?? null]);

beforeEach(() => B.vaciar());

describe("pedido creado por el sistema al aceptar (etapa B)", () => {
  it("transferencia con seña: total con descuento, seña hoy y el saldo en tres cuotas, sugeridas por transferencia", async () => {
    aceptado(`p3${SUFIJO_TRANSFERENCIA}`, true);
    const r = await C.confirmarPedidoPorSistema("ws-1", "pre-1", deps);
    expect(r.ok).toBe(true);
    const p = B.datos.fotofficePedido[0]!;
    expect(Number(p.totalArs)).toBe(940_000);
    expect(p.createdByUserId ?? null).toBeNull();
    expect(cuotas()).toEqual([
      ["2026-10-15", 282_000, "TRANSFERENCIA"],
      ["2026-11-15", 219_333.33, "TRANSFERENCIA"],
      ["2026-12-15", 219_333.33, "TRANSFERENCIA"],
      ["2027-01-15", 219_333.34, "TRANSFERENCIA"],
    ]);
    expect(B.datos.fotofficePresupuesto[0]!.pedidoPorConfirmar).toBe(false);
  });

  it("sin condiciones de cobro: igual que la confirmación a mano (sin seña ni medio)", async () => {
    aceptado("p3", false);
    const r = await C.confirmarPedidoPorSistema("ws-1", "pre-1", deps);
    expect(r.ok).toBe(true);
    expect(cuotas().map((c) => c[2])).toEqual([null, null, null]);
  });

  it("una sola vez: la segunda devuelve el pedido que ya está", async () => {
    aceptado("p3", false);
    const a = await C.confirmarPedidoPorSistema("ws-1", "pre-1", deps);
    const b = await C.confirmarPedidoPorSistema("ws-1", "pre-1", deps);
    expect(b).toEqual({ ok: false, error: M.yaTienePedido, pedidoId: (a as { pedidoId: string }).pedidoId });
    expect(B.datos.fotofficePedido).toHaveLength(1);
  });
});
