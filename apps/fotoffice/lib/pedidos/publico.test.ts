import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

/**
 * Task 7 (datos): las páginas públicas del pedido y del recibo. Tokens cruzados, otro workspace,
 * enlace renovado, recibo anulado, y que nada interno (costos, motivos, responsable, otros pedidos)
 * llegue a la vista ni se lea de la base.
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: async () => ({ movido: false }) }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({
    workspaceId: ws, slug: ws === "ws-1" ? "dnxestudio" : "otro", customDomain: null, nombre: ws === "ws-1" ? "Estudio DNX" : "Otro",
    logoUrl: "https://cdn.test/logo.png", whatsapp: "+54 9 341 555-1234", email: "hola@estudio.test",
  }),
  workspaceDelSlug: async () => null,
}));

const CO = await import("./cobros");
const EN = await import("./enlace");
const PU = await import("./publico");
const VP = await import("./vista-publica");

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const deps = { ahora: () => AHORA, clave: CLAVE, appOrigin: "https://app.test" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

/** Marcas que nunca pueden llegar a la vista pública. */
const SECRETOS = ["98765", "MOTIVO-CANCELACION-SECRETO", "ANULACION-SECRETA", "laura@persona.test", "NOTA-INTERNA", "OTRO-PEDIDO"];

const ITEMS = [
  { id: "a", productId: "prod-1", nombre: "Cobertura", descripcion: "8 horas", cantidad: 1, precioUnitario: 100000, descuento: null, modoPrecio: "CALCULO",
    calculo: { costoTotal: 98765, margen: 0.6, entrada: { horas: 8 } }, seccion: "Fotografía", opcional: false },
  { id: "b", productId: null, nombre: "Álbum", descripcion: null, cantidad: 2, precioUnitario: 10000, descuento: null, modoPrecio: "LISTA",
    calculo: null, seccion: "Fotografía", opcional: false },
];
const TOTALS = {
  subtotal: 120000, descuentoItems: 0, descuentoGlobal: 0, iva: 0, total: 120000, opcionales: { cantidad: 0, total: 0 }, secciones: [],
  renglones: { a: { bruto: 100000, descuento: 0, neto: 100000 }, b: { bruto: 20000, descuento: 0, neto: 20000 } }, descuento: null,
};

let n = 0;
async function cobro(pedidoId: string, importe: number) {
  const r = await CO.registrarCobro(DUENO, { pedidoId, importe, fecha: "2026-10-07", medio: "TRANSFERENCIA", idempotencyKey: `clave-form-${++n}` }, deps);
  if (!r.ok) throw new Error(r.error);
  return r.cobroId;
}

async function tokenDelPedido(pedidoId = "ped-1"): Promise<string> {
  const e = await EN.enlaceDelPedidoDelSistema("ws-1", pedidoId, {}, deps);
  if (!e.ok) throw new Error(e.error);
  return decodeURIComponent(e.url.split("/pedido/")[1]!);
}

beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null, email: "laura@persona.test", notes: "NOTA-INTERNA" });
  B.agregar("cashAccount", { id: "banco", workspaceId: "ws-1", name: "Banco", kind: "DIGITAL", isDefault: true });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  B.agregar("fotofficePedido", {
    id: "ped-1", workspaceId: "ws-1", number: "2026-0001", clientId: "cli-1", status: "CONFIRMADO", items: ITEMS, totals: TOTALS, totalArs: "120000.00",
    paymentOption: { id: "p3", tipo: "CUOTAS", cuotas: 2, total: 120000, importeCuota: 60000, descuentoPorcentaje: 0, interesPorcentaje: 0, interes: 0, nota: "NOTA-INTERNA", etiqueta: "2 cuotas sin interés" },
    eventDate: new Date("2026-12-12T00:00:00Z"), eventLabel: "Boda", ownerUserId: 1, createdByUserId: 1, incomeCategoryId: null,
  });
  B.agregar("fotofficePedidoCuota", { id: "c1", workspaceId: "ws-1", pedidoId: "ped-1", position: 1, dueDate: new Date("2026-10-07T00:00:00Z"), amountArs: "60000.00" });
  B.agregar("fotofficePedidoCuota", { id: "c2", workspaceId: "ws-1", pedidoId: "ped-1", position: 2, dueDate: new Date("2026-11-07T00:00:00Z"), amountArs: "60000.00" });
  // Otro pedido del mismo workspace: nada suyo puede aparecer en el enlace de ped-1.
  B.agregar("fotofficePedido", {
    id: "ped-2", workspaceId: "ws-1", number: "OTRO-PEDIDO", clientId: "cli-1", status: "CONFIRMADO", items: [], totals: {}, totalArs: "5000.00",
    eventLabel: "OTRO-PEDIDO",
  });
  B.agregar("fotofficePedidoCuota", { id: "c9", workspaceId: "ws-1", pedidoId: "ped-2", position: 1, dueDate: new Date("2026-10-07T00:00:00Z"), amountArs: "5000.00" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("enlace público del pedido", () => {
  it("muestra marca, número, evento, ítems, totales, plan con estado y saldo, y los recibos con su enlace", async () => {
    const r1 = await cobro("ped-1", 40000.5);
    await cobro("ped-2", 5000);
    const token = await tokenDelPedido();
    const v = await PU.abrirPedidoPublico("ws-1", token, deps);
    expect(v).not.toBeNull();
    expect(v!.organizacion).toMatchObject({ nombre: "Estudio DNX", logoUrl: "https://cdn.test/logo.png", email: "hola@estudio.test" });
    expect(v!.organizacion.whatsappUrl).toContain("wa.me");
    expect(v!.numero).toBe("2026-0001");
    expect(v!.estado).toBe("EN_CURSO");
    expect(v!.evento).toEqual({ fecha: "12/12/2026", etiqueta: "Boda" });
    expect(v!.items.map((i) => [i.nombre, i.neto])).toEqual([["Cobertura", 100000], ["Álbum", 20000]]);
    expect(Object.keys(v!.items[0]!).sort()).toEqual(["cantidad", "descripcion", "descuento", "id", "neto", "nombre", "opcional", "precioUnitario", "seccion"]);
    expect(v!.formaDePago).toEqual({ etiqueta: "2 cuotas sin interés", interes: 0 });
    expect(v!.plan).toMatchObject({ total: 120000, cobrado: 40000.5, saldo: 79999.5 });
    expect(v!.plan.cuotas.map((c) => [c.numero, c.vence, c.estadoEtiqueta, c.saldo])).toEqual([
      [1, "07/10/2026", "Parcial", 19999.5],
      [2, "07/11/2026", "Pendiente", 60000],
    ]);
    expect(v!.recibos).toHaveLength(1);
    expect(v!.recibos[0]).toMatchObject({ fecha: "07/10/2026", importe: 40000.5, medio: "Transferencia", anulado: false });
    expect(v!.recibos[0]!.url).toBe(`https://app.test/w/dnxestudio/recibo/${EN.tokenDelRecibo(r1, CLAVE)}`);
    const json = JSON.stringify(v);
    for (const s of SECRETOS) expect(json, s).not.toContain(s);
    expect(json).not.toContain("ped-1");
    expect(json).not.toContain(r1);
  });

  it("un pedido cancelado se ve como cancelado, sin el motivo", async () => {
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    B.datos.fotofficePedido[0]!.cancelReason = "MOTIVO-CANCELACION-SECRETO";
    const v = await PU.abrirPedidoPublico("ws-1", await tokenDelPedido(), deps);
    expect(v!.estadoEtiqueta).toBe("Cancelado");
    expect(JSON.stringify(v)).not.toContain("MOTIVO-CANCELACION-SECRETO");
  });

  it("token de recibo, de otro workspace, renovado, inventado o sin forma: no abre", async () => {
    const recibo = EN.tokenDelRecibo(await cobro("ped-1", 1000), CLAVE);
    const token = await tokenDelPedido();
    expect(await PU.abrirPedidoPublico("ws-1", recibo, deps)).toBeNull();
    expect(await PU.abrirPedidoPublico("ws-2", token, deps)).toBeNull();
    expect(await PU.abrirPedidoPublico("ws-1", EN.tokenDelPedido("ped-1", "otra-clave"), deps)).toBeNull();
    expect(await PU.abrirPedidoPublico("ws-1", "corto", deps)).toBeNull();
    expect(await PU.abrirPedidoPublico("ws-1", undefined, deps)).toBeNull();
    // Renovar el enlace: el viejo deja de abrir y el nuevo abre.
    const nuevo = await EN.enlaceDelPedidoDelSistema("ws-1", "ped-1", { rotar: true }, deps);
    expect(nuevo.ok).toBe(true);
    expect(await PU.abrirPedidoPublico("ws-1", token, deps)).toBeNull();
    expect(await PU.abrirPedidoPublico("ws-1", decodeURIComponent((nuevo as { url: string }).url.split("/pedido/")[1]!), deps)).not.toBeNull();
  });

  it("si no hay cómo armar la dirección de los recibos, la lista sale igual pero sin enlaces", async () => {
    await cobro("ped-1", 1000);
    const token = await tokenDelPedido();
    const v = await PU.abrirPedidoPublico("ws-1", token, { ...deps, appOrigin: "" });
    // Sin origen y sin dominio propio no hay cómo armar la dirección.
    expect(v!.recibos[0]!.url).toBeNull();
  });
});

describe("enlace público del recibo", () => {
  it("número, fecha, cliente, concepto, importe en números y en letras, medio, cuotas y leyenda", async () => {
    const id = await cobro("ped-1", 120000.5 - 0.5);
    const v = await PU.abrirReciboPublico("ws-1", EN.tokenDelRecibo(id, CLAVE));
    expect(v).toMatchObject({
      numero: "2026-0001",
      fecha: "07/10/2026",
      cliente: "Laura Pérez",
      concepto: "Pedido N° 2026-0001 · Boda",
      importe: 120000,
      medio: "Transferencia",
      anulado: false,
      leyenda: "Documento no válido como factura",
    });
    expect(v!.importeEnLetras).toContain("ciento veinte mil pesos");
    expect(v!.cuotas).toEqual([
      { numero: 1, vence: "07/10/2026", importe: 60000 },
      { numero: 2, vence: "07/11/2026", importe: 60000 },
    ]);
    expect(v!.organizacion.nombre).toBe("Estudio DNX");
  });

  it("anulado: abre con la marca ANULADO y sin el motivo", async () => {
    const id = await cobro("ped-1", 1000);
    const r = await CO.anularCobro(DUENO, id, "ANULACION-SECRETA", deps);
    expect(r.ok).toBe(true);
    const v = await PU.abrirReciboPublico("ws-1", EN.tokenDelRecibo(id, CLAVE));
    expect(v!.anulado).toBe(true);
    const json = JSON.stringify(v);
    for (const s of SECRETOS) expect(json, s).not.toContain(s);
    expect(json).not.toContain(id);
  });

  it("token del pedido, de otro workspace, de otra clave o sin forma: no abre", async () => {
    const id = await cobro("ped-1", 1000);
    expect(await PU.abrirReciboPublico("ws-1", await tokenDelPedido())).toBeNull();
    expect(await PU.abrirReciboPublico("ws-2", EN.tokenDelRecibo(id, CLAVE))).toBeNull();
    expect(await PU.abrirReciboPublico("ws-1", EN.tokenDelRecibo(id, "otra-clave"))).toBeNull();
    expect(await PU.abrirReciboPublico("ws-1", "x".repeat(200))).toBeNull();
  });
});

describe("las lecturas públicas no piden campos internos", () => {
  const PROHIBIDOS = [
    "cancelReason", "voidReason", "ownerUserId", "createdByUserId", "incomeCategoryId", "presupuestoId", "acceptedVersionId",
    "consultaLeadId", "feeArs", "netArs", "cashMovementId", "voidCashMovementId", "attachmentId", "idempotencyKey",
    "providerPaymentRef", "costSnapshot", "email", "phone", "notes",
  ];

  it("ningún select de abrir el pedido o el recibo trae un campo interno", async () => {
    const id = await cobro("ped-1", 1000);
    const token = await tokenDelPedido();
    const pedidos: Record<string, unknown>[] = [];
    const tablas = ["fotofficePedido", "fotofficeCobro", "fotofficePedidoCuota", "fotofficeCobroImputacion", "client"] as const;
    // `B.tablas`: reemplazar un método acá lo cambia para `prisma` y para `tx`.
    const originales: (() => void)[] = [];
    onTestFinished(() => originales.forEach((f) => f()));
    const T = B.tablas as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>;
    for (const t of tablas) {
      for (const m of ["findFirst", "findMany", "findUnique"]) {
        const original = T[t]![m]!;
        originales.push(() => (T[t]![m] = original));
        T[t]![m] = async (...a: unknown[]) => {
          const arg = a[0] as { select?: Record<string, unknown> } | undefined;
          pedidos.push({ tabla: t, select: arg?.select ?? "TODO" });
          return original(...a);
        };
      }
    }
    expect(await PU.abrirPedidoPublico("ws-1", token, deps)).not.toBeNull();
    expect(await PU.abrirReciboPublico("ws-1", EN.tokenDelRecibo(id, CLAVE))).not.toBeNull();
    expect(pedidos.length).toBeGreaterThan(4);
    for (const p of pedidos) {
      expect(p.select, JSON.stringify(p)).not.toBe("TODO");
      for (const k of PROHIBIDOS) expect(Object.keys(p.select as object), `${p.tabla}.${k}`).not.toContain(k);
    }
  });

  it("armarVistaPedido copia campo por campo: la instantánea del cálculo de un ítem no pasa", () => {
    const v = VP.armarVistaPedido({
      organizacion: { nombre: "X", logoUrl: null, whatsappUrl: null, email: null },
      numero: "1", estado: "CONFIRMADO", eventDate: null, eventLabel: null,
      items: [{ ...ITEMS[0], costSnapshot: { total: 98765 } } as never],
      totals: TOTALS as never,
      formaDePago: null,
      plan: { cuotas: [], total: 0, cobrado: 0, saldo: 0, aCobrar: 0, vencido: 0, cuotasVencidas: 0, proximoVencimiento: null, descuadrado: false } as never,
      recibos: [],
    });
    expect(JSON.stringify(v)).not.toContain("98765");
    expect(JSON.stringify(v)).not.toContain("prod-1");
  });
});
