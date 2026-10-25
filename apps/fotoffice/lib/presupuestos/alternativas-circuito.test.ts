import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail, SendOutcome } from "@/lib/communications/send-email";

/**
 * Presupuesto con opciones, de punta a punta sobre la base en memoria: guardar el borrador con dos
 * opciones, enviarlo, abrir el enlace, aceptar UNA, y el pedido que nace (ítems, total y seña de la
 * elegida). Y que sin opciones todo quede igual que antes.
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  real: vi.fn(),
  notificar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ movido: true })),
  reabrir: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ reabierta: false })),
  ganar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ cerrado: true })),
  nivel: vi.fn(async (..._a: unknown[]) => true),
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
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.real }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar, reabrirComoGanadaPorSistema: H.reabrir, ganarConsultaPorSistema: H.ganar }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));
vi.mock("./sitio", () => ({
  sitioDelWorkspace: async (ws: string) =>
    ws === "ws-1" ? { workspaceId: "ws-1", slug: "dnx", customDomain: null, nombre: "Estudio DNX", logoUrl: null, whatsapp: null, email: "hola@estudio.test" } : null,
  workspaceDelSlug: async (s: string) => (s === "dnx" ? "ws-1" : null),
}));

const P = await import("./presupuestos");
const EN = await import("./envio");
const L = await import("./enlace");
const PU = await import("./publico");
const AC = await import("./aceptacion");
const { confirmarPedidoPorSistema } = await import("@/lib/pedidos/confirmar");
const { MENSAJES_ALTERNATIVAS } = await import("./alternativas");
const { pesos } = await import("./editor");

const AHORA = new Date("2026-10-25T15:00:00.000Z"); // 12:00 en Buenos Aires
const CLAVE = "clave-de-prueba";
const ORIGEN = "https://fotoffice.test";
const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
const deps = { ahora: () => AHORA, tieneGestionar: H.nivel };
const evidencia = { ipHash: "hash-ip", userAgent: "Mozilla/5.0" };

const enviador = (r: SendOutcome = { status: "SENT", providerId: "re_1" }) => vi.fn(async (_m: OutboundEmail) => r);
const token = (versionId: string) => L.tokenDeVersion(versionId, CLAVE);
const version = (id: string) => B.datos.fotofficePresupuestoVersion.find((v) => v.id === id)!;

const OPCIONES_PAGO = {
  cashEnabled: true,
  cashDiscountPercent: "",
  cashCommercialNote: "",
  installmentPlans: [{ id: "p3", numberOfInstallments: "3", interestMode: "none", interestPercent: "", commercialNote: "" }],
};
const ALTERNATIVAS = [
  { id: "basico", nombre: "Básico", descripcion: "Lo esencial", masElegida: false },
  { id: "premium", nombre: "Premium", descripcion: "Todo el día", masElegida: true },
];
const itemLista = (id: string, precio: number, datos: Record<string, unknown> = {}) => ({
  id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: precio, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
});
const ITEMS = [
  itemLista("b1", 600_000, { alternativaId: "basico" }),
  itemLista("b2", 400_000, { alternativaId: "basico" }),
  itemLista("p1", 1_500_000, { alternativaId: "premium" }),
  itemLista("p2", 500_000, { alternativaId: "premium" }),
];

function plantilla() {
  return B.agregar("fotofficeMessageTemplate", {
    workspaceId: "ws-1", channel: "EMAIL", entityType: "PRESUPUESTO", name: "Presupuesto",
    subject: "Presupuesto N° [presupuesto_numero]", body: "Hola [nombre]: [presupuesto_enlace] Total [presupuesto_total].\n\n[firma]",
  }).id as string;
}

async function enviado(entrada: Record<string, unknown>) {
  const r = await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-1" }, deps);
  if (!r.ok) throw new Error(r.error);
  const g = await P.guardarBorrador(DUENO, r.presupuestoId, entrada as never, deps);
  if (!g.ok) throw new Error(g.error);
  const correo = enviador();
  const e = await EN.enviarPresupuesto(DUENO, r.presupuestoId, { canal: "EMAIL", templateId: plantilla() }, { clave: CLAVE, appOrigin: ORIGEN, ahora: () => AHORA, enviar: correo });
  if (!e.ok) throw new Error(e.error);
  return { ...r, versionId: e.versionId!, correo };
}

const aceptar = (versionId: string, datos: Record<string, unknown>) =>
  AC.aceptarPresupuesto("ws-1", token(versionId), { nombre: "Laura Pérez", acepta: true, ...datos }, evidencia, {
    ahora: () => AHORA,
    enviar: enviador(),
    mercadoPago: async () => true,
    autoPedido: async () => true,
    crearPedido: (ws: string, id: string) => confirmarPedidoPorSistema(ws, id, { ahora: () => AHORA }),
    enlaceDelPedido: async () => ({ ok: true as const, url: `${ORIGEN}/w/dnx/pedido/tok` }),
  });

const cuotas = () =>
  B.datos.fotofficePedidoCuota.sort((a, b) => (a.position as number) - (b.position as number)).map((c) => Number(c.amountArs));

beforeEach(() => {
  B.vaciar();
  H.real.mockReset();
  H.nivel.mockResolvedValue(true);
  B.agregar("serviceSalesLead", {
    id: "lead-1", workspaceId: "ws-1", name: "Laura Pérez", email: "laura@persona.test", phone: null, eventType: "XV",
    eventDate: new Date("2027-03-20T00:00:00.000Z"), eventLocation: "Rosario", message: null,
  });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "lead-1", clientId: "cli-1", categoryId: "cat", eventStartsAt: new Date("2027-03-20T00:00:00.000Z") });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 1, role: "WORKSPACE_OWNER", createdAt: new Date("2025-01-01") });
  B.agregar("user", { id: 1, email: "dueno@estudio.test", name: "Dueño" });
  B.agregar("fotofficePresupuestoAjustes", { workspaceId: "ws-1", validityDays: 15, followUpDays: 3, followUpEnabled: false, paymentOptions: OPCIONES_PAGO });
  // Seña del 30 % (perfil de precios de la organización).
  B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", schemaVersion: 1, profileData: { pricingExtras: { depositPercent: "30" } } });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("presupuesto con opciones, de punta a punta", () => {
  it("guarda cada opción con su total; al enviar congela las formas de pago de cada una y el correo dice «desde»", async () => {
    const { versionId, correo } = await enviado({ items: ITEMS, alternativas: ALTERNATIVAS });
    const v = version(versionId);
    const totals = v.totals as { total: number; alternativas: { id: string; totales: { total: number } }[] };
    // Arriba, la principal (Premium, la más elegida).
    expect(totals.total).toBe(2_000_000);
    expect(totals.alternativas.map((a) => [a.id, a.totales.total])).toEqual([["basico", 1_000_000], ["premium", 2_000_000]]);
    const pago = v.paymentOptions as { basePrice: number; porAlternativa: Record<string, { basePrice: number }> };
    expect(pago.porAlternativa.basico!.basePrice).toBe(1_000_000);
    expect(pago.porAlternativa.premium!.basePrice).toBe(2_000_000);
    expect(correo.mock.calls[0]![0].text).toContain(`Total desde ${pesos(1_000_000)}`);
  });

  it("el enlace muestra las dos opciones con sus formas de pago (seña y cuotas de cada una)", async () => {
    const { versionId } = await enviado({ items: ITEMS, alternativas: ALTERNATIVAS });
    const r = await PU.abrirPresupuestoPublico("ws-1", token(versionId), { registrar: false, ipHash: null, userAgent: null }, { clave: CLAVE, appOrigin: ORIGEN, ahora: () => AHORA, mercadoPago: async () => true });
    const vista = r && "vista" in r ? r.vista : null;
    expect(vista?.alternativas.map((a) => [a.nombre, a.masElegida, a.totales.total, a.items.length])).toEqual([
      ["Básico", false, 1_000_000, 2],
      ["Premium", true, 2_000_000, 2],
    ]);
    const basico = vista!.alternativas[0]!;
    expect(basico.opcionesPago.find((o) => o.id === "p3")).toMatchObject({ cuotas: 3, total: 1_000_000, sena: 300_000 });
    expect(vista!.alternativas[1]!.opcionesPago.find((o) => o.id === "p3")).toMatchObject({ total: 2_000_000, sena: 600_000 });
  });

  it("con varias opciones, aceptar sin elegir una no se puede", async () => {
    const { versionId } = await enviado({ items: ITEMS, alternativas: ALTERNATIVAS });
    expect(await aceptar(versionId, { opcion: "p3" })).toEqual({ ok: false, error: MENSAJES_ALTERNATIVAS.elegir });
    expect(await aceptar(versionId, { opcion: "p3", alternativa: "deluxe" })).toEqual({ ok: false, error: MENSAJES_ALTERNATIVAS.elegir });
    expect(version(versionId).acceptedAt ?? null).toBeNull();
  });

  it("aceptar Básico fija esa opción; el pedido lleva sólo sus ítems, su total y la seña sobre ella", async () => {
    const { versionId, presupuestoId } = await enviado({ items: ITEMS, alternativas: ALTERNATIVAS });
    const r = await aceptar(versionId, { opcion: "p3", alternativa: "basico" });
    expect(r).toMatchObject({ ok: true });
    const v = version(versionId);
    expect(v.totals).toMatchObject({ total: 1_000_000, alternativaElegidaId: "basico" });
    expect(v.paymentOptions).toMatchObject({ basePrice: 1_000_000 });
    expect(v.chosenPaymentOptionId).toBe("p3");

    const pedido = B.datos.fotofficePedido.find((p) => p.presupuestoId === presupuestoId)!;
    expect((pedido.items as { id: string }[]).map((i) => i.id)).toEqual(["b1", "b2"]);
    expect(Number(pedido.totalArs)).toBe(1_000_000);
    // Seña del 30 % de Básico hoy y el saldo en tres cuotas.
    expect(cuotas()).toEqual([300_000, 233_333.33, 233_333.33, 233_333.34]);

    // Ya aceptado: el enlace muestra sólo la elegida.
    const abierto = await PU.abrirPresupuestoPublico("ws-1", token(versionId), { registrar: false, ipHash: null, userAgent: null }, { clave: CLAVE, appOrigin: ORIGEN, ahora: () => AHORA, mercadoPago: async () => true, enlaceDelPedido: async () => null });
    const vista = abierto && "vista" in abierto ? abierto.vista : null;
    expect(vista?.alternativas).toEqual([]);
    expect(vista?.alternativaElegida).toBe("Básico");
    expect(vista?.items.map((i) => i.id)).toEqual(["b1", "b2"]);
  });

  it("aceptar Premium: los ítems, el total y la seña son los de Premium", async () => {
    const { versionId, presupuestoId } = await enviado({ items: ITEMS, alternativas: ALTERNATIVAS });
    expect((await aceptar(versionId, { opcion: "contado", alternativa: "premium" })).ok).toBe(true);
    const pedido = B.datos.fotofficePedido.find((p) => p.presupuestoId === presupuestoId)!;
    expect((pedido.items as { id: string }[]).map((i) => i.id)).toEqual(["p1", "p2"]);
    expect(Number(pedido.totalArs)).toBe(2_000_000);
    expect(cuotas()).toEqual([600_000, 1_400_000]);
  });

  it("una opción sin ítems no se puede enviar", async () => {
    const r = await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-1" }, deps);
    if (!r.ok) throw new Error(r.error);
    await P.guardarBorrador(DUENO, r.presupuestoId, { items: ITEMS.slice(0, 2), alternativas: ALTERNATIVAS.map((a) => ({ ...a, masElegida: false })) } as never, deps);
    const e = await EN.enviarPresupuesto(DUENO, r.presupuestoId, { canal: "EMAIL", templateId: plantilla() }, { clave: CLAVE, appOrigin: ORIGEN, ahora: () => AHORA, enviar: enviador() });
    expect(e).toMatchObject({ ok: false, error: MENSAJES_ALTERNATIVAS.sinItems("Premium") });
  });

  it("guardar sin mandar opciones (DNX Bot) conserva las guardadas y lo nuevo va a la principal", async () => {
    const r = await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-1" }, deps);
    if (!r.ok) throw new Error(r.error);
    await P.guardarBorrador(DUENO, r.presupuestoId, { items: ITEMS, alternativas: ALTERNATIVAS } as never, deps);
    const g = await P.guardarBorrador(DUENO, r.presupuestoId, { items: [...ITEMS, itemLista("bot", 100_000)] } as never, deps);
    expect(g.ok).toBe(true);
    const v = B.datos.fotofficePresupuestoVersion.find((x) => x.presupuestoId === r.presupuestoId)!;
    expect((v.items as { id: string; alternativaId?: string }[]).find((i) => i.id === "bot")?.alternativaId).toBe("premium");
    expect((v.totals as { alternativas: unknown[] }).alternativas).toHaveLength(2);
  });
});

describe("sin opciones, todo como antes", () => {
  it("los totales no llevan opciones, se acepta sin elegir nada y el pedido lleva todos los ítems", async () => {
    const items = [itemLista("a", 700_000), itemLista("b", 300_000)];
    const { versionId, presupuestoId } = await enviado({ items });
    const v = version(versionId);
    expect("alternativas" in (v.totals as object)).toBe(false);
    expect("porAlternativa" in (v.paymentOptions as object)).toBe(false);
    expect((v.items as object[]).some((i) => "alternativaId" in i)).toBe(false);
    expect((await aceptar(versionId, { opcion: "p3" })).ok).toBe(true);
    expect("alternativaElegidaId" in (version(versionId).totals as object)).toBe(false);
    const pedido = B.datos.fotofficePedido.find((p) => p.presupuestoId === presupuestoId)!;
    expect((pedido.items as { id: string }[]).map((i) => i.id)).toEqual(["a", "b"]);
    expect(Number(pedido.totalArs)).toBe(1_000_000);
    expect(cuotas()).toEqual([300_000, 233_333.33, 233_333.33, 233_333.34]);
  });

  it("una versión vieja (como las de la migración de Alboom: sin opciones ni formas de pago) se acepta igual", async () => {
    const items = [itemLista("a", 500_000)];
    const { versionId } = await enviado({ items });
    const v = version(versionId);
    v.paymentOptions = null;
    expect((await aceptar(versionId, {})).ok).toBe(true);
    expect(version(versionId).chosenPaymentOptionId ?? null).toBeNull();
  });
});
