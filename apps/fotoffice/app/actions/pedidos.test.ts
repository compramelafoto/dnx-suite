import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Acciones de Pedidos (Task 6, pantallas): la forma de lo que llega se revisa antes de armar el
 * contexto, sin contexto no se toca nada, y cada acción llama a `lib/pedidos` con el contexto de la
 * sesión (nunca con un workspace que mande el navegador).
 */

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  revalidate: vi.fn(),
  after: vi.fn(),
  enviar: vi.fn(),
  cobrar: vi.fn(),
  anular: vi.fn(),
  plan: vi.fn(),
  estado: vi.fn(),
  rubro: vi.fn(),
  confirmar: vi.fn(),
  vista: vi.fn(),
  manual: vi.fn(),
  enlacePedido: vi.fn(),
  enlaceRecibo: vi.fn(),
  recibo: vi.fn(),
  generar: vi.fn(),
  guardarCuenta: vi.fn(),
  borrarCuenta: vi.fn(),
  pagar: vi.fn(),
  anularPago: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("next/server", () => ({ after: H.after }));
vi.mock("@/lib/pedidos/contexto", () => ({ contextoDePedidos: H.ctx }));
vi.mock("@/lib/pedidos/envio", () => ({ enviarMensajePedido: H.enviar }));
vi.mock("@/lib/pedidos/cobros", () => ({ registrarCobro: H.cobrar, anularCobro: H.anular }));
vi.mock("@/lib/pedidos/plan", () => ({ editarPlan: H.plan }));
vi.mock("@/lib/pedidos/pedidos", () => ({ cambiarEstadoPedido: H.estado, cambiarRubro: H.rubro, crearPedidoManual: H.manual }));
vi.mock("@/lib/pedidos/confirmar", () => ({ confirmarPedido: H.confirmar, vistaPreviaConfirmacion: H.vista }));
vi.mock("@/lib/pedidos/enlace", () => ({ enlaceDelPedido: H.enlacePedido, enlaceDelRecibo: H.enlaceRecibo }));
vi.mock("@/lib/pedidos/recibos", () => ({ enviarReciboAutomatico: H.recibo }));
vi.mock("@/lib/pedidos/cuentas-pagar", () => ({
  generarCostosDelPedido: H.generar,
  guardarCuenta: H.guardarCuenta,
  borrarCuenta: H.borrarCuenta,
  pagarCuenta: H.pagar,
  anularPagoCuenta: H.anularPago,
}));

const A = await import("./pedidos");
const { MENSAJES_PEDIDO: M } = await import("@/lib/pedidos/acceso");

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const SIN_ACCESO = { ok: false, error: M.sinPermiso };
const INVALIDO = { ok: false, error: M.datosInvalidos };
const LIB = [
  H.enviar, H.cobrar, H.anular, H.plan, H.estado, H.rubro, H.confirmar, H.vista, H.manual, H.enlacePedido, H.enlaceRecibo,
  H.generar, H.guardarCuenta, H.borrarCuenta, H.pagar, H.anularPago,
];

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue(CTX);
  H.enviar.mockResolvedValue({ ok: true, whatsappUrl: null });
  H.cobrar.mockResolvedValue({ ok: true, cobroId: "cob-1", pedidoId: "ped-1", reciboNumero: "2026-0001", creado: true, primero: true });
  H.anular.mockResolvedValue({ ok: true, yaAnulado: false, pedidoId: "ped-1" });
  H.rubro.mockResolvedValue({ ok: true });
  H.enlaceRecibo.mockResolvedValue({ ok: true, url: "https://x/recibo/t" });
});

describe("enviarMensajePedidoAction", () => {
  it("revisa la forma antes de armar el contexto", async () => {
    for (const malo of [
      null,
      { pedidoId: "", canal: "EMAIL" },
      { pedidoId: "ped-1", canal: 3 },
      { pedidoId: "ped-1", canal: "EMAIL", templateId: 5 },
      { pedidoId: "ped-1", canal: "EMAIL", cuerpo: {} },
      { pedidoId: "ped-1", canal: "EMAIL", cobroId: "x".repeat(65) },
    ]) {
      expect(await A.enviarMensajePedidoAction(malo as never)).toEqual(INVALIDO);
    }
    expect(H.ctx).not.toHaveBeenCalled();
    for (const f of LIB) expect(f).not.toHaveBeenCalled();
  });

  it("sin contexto (sin sesión, módulo apagado o sin Gestionar) no envía nada", async () => {
    H.ctx.mockResolvedValue(null);
    expect(await A.enviarMensajePedidoAction({ pedidoId: "ped-1", canal: "EMAIL", cuerpo: "Hola" })).toEqual(SIN_ACCESO);
    expect(H.ctx).toHaveBeenCalledWith("operar");
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("envía con el contexto de la sesión y revalida la ficha", async () => {
    const r = await A.enviarMensajePedidoAction({ pedidoId: "ped-1", canal: "WHATSAPP", templateId: "pl-1", cuerpo: "Hola", cobroId: "cob-1" });
    expect(r).toEqual({ ok: true, whatsappUrl: null });
    expect(H.enviar).toHaveBeenCalledWith(CTX, "ped-1", { canal: "WHATSAPP", templateId: "pl-1", asunto: null, cuerpo: "Hola", cobroId: "cob-1" });
    expect(H.revalidate).toHaveBeenCalledWith("/pedidos/ped-1");
  });
});

describe("cobro, anulación, rubro y recibo", () => {
  it("registrar cobro: forma, contexto Gestionar y recibo automático sólo si se creó", async () => {
    expect(await A.registrarCobroAction({ pedidoId: "ped-1", importe: "10" as never, fecha: "2026-10-07", medio: "EFECTIVO", idempotencyKey: "clave-1234" })).toEqual(INVALIDO);
    expect(H.ctx).not.toHaveBeenCalled();
    const datos = { pedidoId: "ped-1", importe: 1000, fecha: "2026-10-07", medio: "EFECTIVO", idempotencyKey: "clave-1234" };
    await A.registrarCobroAction(datos);
    expect(H.ctx).toHaveBeenCalledWith("operar");
    expect(H.cobrar).toHaveBeenCalledWith(CTX, expect.objectContaining({ pedidoId: "ped-1", importe: 1000, idempotencyKey: "clave-1234" }));
    expect(H.after).toHaveBeenCalledTimes(1);
    H.cobrar.mockResolvedValue({ ok: true, cobroId: "cob-1", pedidoId: "ped-1", reciboNumero: "2026-0001", creado: false, primero: false });
    await A.registrarCobroAction(datos);
    expect(H.after).toHaveBeenCalledTimes(1);
  });

  it("anular pide motivo en texto; el enlace del recibo alcanza con Ver", async () => {
    expect(await A.anularCobroAction({ cobroId: "cob-1", motivo: 3 as never })).toEqual(INVALIDO);
    await A.anularCobroAction({ cobroId: "cob-1", motivo: "Error" });
    expect(H.anular).toHaveBeenCalledWith(CTX, "cob-1", "Error");
    await A.enlaceDelReciboAction({ cobroId: "cob-1" });
    expect(H.ctx).toHaveBeenLastCalledWith("ver");
  });

  it("cambiar rubro: ids con forma y contexto de la sesión", async () => {
    expect(await A.cambiarRubroPedidoAction({ pedidoId: "ped-1", categoryId: "" })).toEqual(INVALIDO);
    expect(await A.cambiarRubroPedidoAction({ pedidoId: "ped-1", categoryId: "rubro-1" })).toEqual({ ok: true });
    expect(H.rubro).toHaveBeenCalledWith(CTX, "ped-1", "rubro-1");
  });
});

describe("cuentas a pagar", () => {
  beforeEach(() => {
    H.generar.mockResolvedValue({ ok: true, creadas: 2, mensaje: null });
    H.guardarCuenta.mockResolvedValue({ ok: true, cuentaId: "c-1", pedidoId: "ped-1" });
    H.borrarCuenta.mockResolvedValue({ ok: true, cuentaId: "c-1", pedidoId: "ped-1" });
    H.pagar.mockResolvedValue({ ok: true, cuentaId: "c-1", pedidoId: "ped-1", creado: true, movimientoId: "m-1" });
    H.anularPago.mockResolvedValue({ ok: true, yaAnulado: false, pedidoId: "ped-1" });
  });

  it("revisan la forma antes de armar el contexto", async () => {
    expect(await A.generarCostosAction({ pedidoId: "" })).toEqual(INVALIDO);
    expect(await A.guardarCuentaPagarAction({ pedidoId: "ped-1", concepto: "X", importe: "10" as never })).toEqual(INVALIDO);
    expect(await A.guardarCuentaPagarAction({ pedidoId: 3 as never, concepto: "X", importe: 10 })).toEqual(INVALIDO);
    expect(await A.borrarCuentaPagarAction({ cuentaId: "x".repeat(65) })).toEqual(INVALIDO);
    expect(await A.pagarCuentaAction({ cuentaId: "c-1", fecha: "2026-10-07", medio: "EFECTIVO", categoryId: 1 as never, idempotencyKey: "clave-1234" })).toEqual(INVALIDO);
    expect(await A.anularPagoCuentaAction({ cuentaId: "c-1", motivo: null as never })).toEqual(INVALIDO);
    expect(H.ctx).not.toHaveBeenCalled();
    for (const f of LIB) expect(f).not.toHaveBeenCalled();
  });

  it("sin contexto Gestionar no escriben", async () => {
    H.ctx.mockResolvedValue(null);
    expect(await A.pagarCuentaAction({ cuentaId: "c-1", fecha: "2026-10-07", medio: "EFECTIVO", categoryId: "r-1", idempotencyKey: "clave-1234" })).toEqual(SIN_ACCESO);
    expect(await A.generarCostosAction({ pedidoId: "ped-1" })).toEqual(SIN_ACCESO);
    expect(H.ctx).toHaveBeenCalledWith("operar");
    for (const f of LIB) expect(f).not.toHaveBeenCalled();
  });

  it("llaman a lib/pedidos con el contexto de la sesión y revalidan A pagar y la ficha", async () => {
    await A.pagarCuentaAction({ cuentaId: "c-1", fecha: "2026-10-07", medio: "EFECTIVO", categoryId: "r-1", idempotencyKey: "clave-1234" });
    expect(H.pagar).toHaveBeenCalledWith(CTX, { cuentaId: "c-1", fecha: "2026-10-07", medio: "EFECTIVO", categoryId: "r-1", idempotencyKey: "clave-1234" });
    expect(H.revalidate).toHaveBeenCalledWith("/pedidos/a-pagar");
    expect(H.revalidate).toHaveBeenCalledWith("/pedidos/ped-1");
    await A.guardarCuentaPagarAction({ pedidoId: "ped-1", concepto: "Viáticos", importe: 10 });
    expect(H.guardarCuenta).toHaveBeenCalledWith(CTX, { id: null, pedidoId: "ped-1", supplierClientId: null, concepto: "Viáticos", importe: 10, vence: null, costCategoryId: null });
    await A.anularPagoCuentaAction({ cuentaId: "c-1", motivo: "Error" });
    expect(H.anularPago).toHaveBeenCalledWith(CTX, "c-1", "Error");
    await A.borrarCuentaPagarAction({ cuentaId: "c-1" });
    expect(H.borrarCuenta).toHaveBeenCalledWith(CTX, "c-1");
    await A.generarCostosAction({ pedidoId: "ped-1" });
    expect(H.generar).toHaveBeenCalledWith(CTX, "ped-1");
  });
});

describe("fuente de las acciones", () => {
  it("'use server', sólo funciones async, forma → contexto, sin base ni lecturas con costos", () => {
    const src = readFileSync(join(process.cwd(), "app/actions/pedidos.ts"), "utf8");
    expect(src.startsWith('"use server";')).toBe(true);
    const exportados = src.match(/^export .*/gm) ?? [];
    expect(exportados.every((l) => l.startsWith("export async function"))).toBe(true);
    for (const cuerpo of src.split("export async function").slice(1)) {
      const forma = cuerpo.indexOf("return INVALIDO");
      const contexto = cuerpo.indexOf("contextoDePedidos(");
      expect(contexto).toBeGreaterThan(-1);
      expect(forma).toBeLessThan(contexto);
    }
    expect(src).not.toMatch(/leerPedido|listarPedidos|costosDelPedido|@repo\/db/);
  });
});
