import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateCuantoCobro } from "@repo/cuanto-cobro-core";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
} from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

// Los pasos de después del alta de la consulta tienen sus propias pruebas; acá se reemplazan.
const H = vi.hoisted(() => ({
  numerar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ display: "2026-0001" })),
  notificar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({ movido: true })),
  avisar: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({})),
  responder: vi.fn(async (..._a: unknown[]): Promise<unknown> => "ENVIADO"),
  nivel: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/service-leads/numero", () => ({
  numerarConsultaNueva: H.numerar,
  tituloDeConsulta: (nombre: string, numero: string | null | undefined) => (numero ? `Consulta N° ${numero} · ${nombre}` : nombre),
}));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));
vi.mock("@/lib/plantillas/automaticos", () => ({ responderConsultaNueva: H.responder }));
vi.mock("@/lib/consultas/aviso", () => ({ avisarConsultaNueva: H.avisar }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));

const { puede } = await import("@/lib/access/policy");
type AccesoEfectivo = import("@/lib/access/policy").AccesoEfectivo;
const P = await import("./presupuestos");
const V = await import("./versiones");
const A = await import("./ajustes");
const S = await import("./semillas");
const { MENSAJES_PRESUPUESTO: M } = await import("./acceso");
const { asegurarCatalogosDelWorkspace } = await import("@/lib/consultas/semillas");
const { SLUG_DNX } = await import("@/lib/consultas/constantes");

const AHORA = new Date("2026-10-07T15:00:00.000Z");
const deps = { ahora: () => AHORA, tieneGestionar: H.nivel };

const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
const EQUIPO = { workspaceId: "ws-1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: niveles } as never };
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "VIEW" } } as never };
// Tesorería: Caja y Cuotas (verDinero), pero no configura: no ve costos de presupuestos (R4).
const TESORERIA = { workspaceId: "ws-1", userId: 4, userLabel: "Caja", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "MANAGE", cash: "MANAGE", "membership-dues": "MANAGE" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };

function consulta(leadId: string, ws = "ws-1", clientId = `cli-${leadId}`) {
  B.agregar("serviceSalesLead", { id: leadId, workspaceId: ws, name: "X", eventType: "BODA" });
  B.agregar("client", { id: clientId, workspaceId: ws, kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("fotofficeConsulta", { workspaceId: ws, leadId, clientId, categoryId: "cat" });
}

function entradaMotor() {
  return { perfil: createBaseCompleteProfile(), presupuesto: createBaseCompleteQuote({ chosenPrice: "" }) };
}
const SUGERIDO = (() => {
  const r = calculateCuantoCobro(createBaseCompleteProfile(), createBaseCompleteQuote({ chosenPrice: "" }));
  if (r.status !== "complete") throw new Error("fixture incompleta");
  return { precio: Math.round(r.chosenPriceEffective * 100) / 100, minimo: Math.round(r.minimumPrice * 100) / 100 };
})();

const itemLista = (id: string, datos: Record<string, unknown> = {}) => ({
  id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: 1000, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
});

async function nuevo(ctx = DUENO, leadId = "lead-1") {
  const r = await P.crearPresupuesto(ctx, { consultaLeadId: leadId }, deps);
  if (!r.ok) throw new Error(r.error);
  return r;
}

const presupuesto = (id: string) => B.datos.fotofficePresupuesto.find((p) => p.id === id)!;
const versionesDe = (id: string) => B.datos.fotofficePresupuestoVersion.filter((v) => v.presupuestoId === id);

/** Simula el envío (Task 5): congela el borrador, lo deja vigente y pasa a ENVIADO. */
async function enviar(presupuestoId: string, ahora = AHORA) {
  const borrador = versionesDe(presupuestoId).find((v) => v.sentAt === null)!;
  await (B.prisma.$transaction as (fn: (tx: never) => Promise<unknown>) => Promise<unknown>)(async (tx) => {
    expect(await V.congelarVersion(tx, { workspaceId: "ws-1", versionId: borrador.id as string, ahora, tokenHash: `h-${borrador.id}` })).toBe(true);
    await V.revocarAnteriores(tx, { workspaceId: "ws-1", presupuestoId, vigenteId: borrador.id as string, ahora });
    expect(await P.pasarEstado(tx, { workspaceId: "ws-1", presupuestoId, a: "ENVIADO", ahora, datos: { ...P.datosDeEnvio(ahora, { validezDias: 15 }), currentVersionId: borrador.id as string } })).toEqual({ ok: true });
  });
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.nivel.mockReset();
  H.nivel.mockResolvedValue(true);
  H.notificar.mockResolvedValue({ movido: true });
  consulta("lead-1");
  consulta("lead-9", "ws-2");
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toContain("Laura");
  errores.mockRestore();
});

describe("crear", () => {
  it("de una consulta del workspace: borrador con V1 vacía y vigente, responsable = quien lo crea, validez de fábrica (15 días, Buenos Aires)", async () => {
    const r = await nuevo();
    const p = presupuesto(r.presupuestoId);
    expect(p).toMatchObject({ workspaceId: "ws-1", consultaLeadId: "lead-1", clientId: "cli-lead-1", status: "BORRADOR", ownerUserId: 1, currentVersionId: r.versionId });
    expect((p.validUntil as Date).toISOString().slice(0, 10)).toBe("2026-10-22");
    expect(versionesDe(r.presupuestoId)).toHaveLength(1);
    expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ number: 1, sentAt: null, items: [] });
  });

  it("la validez y los textos salen de los ajustes", async () => {
    expect(await A.guardarAjustes(DUENO, { validezDias: 30, condiciones: "Seña 30 %", propuestaPago: "Transferencia", seguimientoDias: 3, seguimientoActivo: false })).toEqual({ ok: true });
    const r = await nuevo();
    expect((presupuesto(r.presupuestoId).validUntil as Date).toISOString().slice(0, 10)).toBe("2026-11-06");
    expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ terms: "Seña 30 %", paymentProposal: "Transferencia" });
  });

  describe("precargado con la propuesta modelo de la categoría", () => {
    const calculado = {
      id: "r2", productId: null, nombre: "Cobertura boda", descripcion: null, cantidad: 1, precioUnitario: 0, descuento: null,
      modoPrecio: "CALCULO", seccion: null, opcional: false,
      calculo: { entrada: { presupuesto: { client: { jobType: "Boda" }, concepts: [{ name: "Cobertura", itemType: "own-service", quantity: "1", coverageHours: "6", editingHours: "4" }] } } },
    };
    const lista = { id: "r1", productId: "prod-a", nombre: "Viejo", descripcion: null, cantidad: 2, precioUnitario: 1, descuento: null, modoPrecio: "LISTA", seccion: null, opcional: false };
    const conPropuesta = (items: unknown[], terms: string | null = "Seña del 30 %.") =>
      B.agregar("fotofficePropuestaModelo", { workspaceId: "ws-1", categoryId: "cat", items, terms, autoSendOnWeb: false });
    beforeEach(() => {
      B.agregar("product", { id: "prod-a", workspaceId: "ws-1", name: "Álbum", description: "30x30", priceArs: "150000.50" });
    });

    it("LISTA + CALCULO: V1 con los ítems al precio de hoy, totales y costos, y las condiciones de la propuesta", async () => {
      B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", profileData: createBaseCompleteProfile() });
      conPropuesta([lista, calculado]);
      const r = await nuevo();
      const v = versionesDe(r.presupuestoId)[0]!;
      const items = v.items as { nombre: string; precioUnitario: number; modoPrecio: string; calculo: unknown }[];
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ nombre: "Álbum", precioUnitario: 150000.5, modoPrecio: "LISTA" });
      expect(items[1]!.modoPrecio).toBe("CALCULO");
      expect(items[1]!.precioUnitario).toBeGreaterThan(0);
      expect(items[1]!.calculo).not.toBeNull();
      const total = (v.totals as { total: number }).total;
      expect(total).toBeCloseTo(2 * 150000.5 + items[1]!.precioUnitario, 2);
      expect(v.terms).toBe("Seña del 30 %.");
      expect((v.costSnapshot as { costoTotal: number }).costoTotal).toBeGreaterThan(0);
    });

    it("un usuario del equipo (sin configurar) obtiene los ítems calculados", async () => {
      B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", profileData: createBaseCompleteProfile() });
      conPropuesta([calculado]);
      const r = await nuevo(EQUIPO);
      const [item] = versionesDe(r.presupuestoId)[0]!.items as { precioUnitario: number }[];
      expect(item!.precioUnitario).toBeGreaterThan(0);
    });

    it("el equipo (sin configurar) guarda el borrador precargado tal como le llega al navegador", async () => {
      B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", profileData: createBaseCompleteProfile() });
      conPropuesta([lista, calculado]);
      const r = await nuevo(EQUIPO);
      const vista = V.versionParaVista(versionesDe(r.presupuestoId)[0] as never, false);
      const items = vista.items as { modoPrecio: string; precioUnitario: number }[];
      const precio = items[1]!.precioUnitario;
      expect(items[1]).toMatchObject({ modoPrecio: "CALCULO", calculo: null });
      expect(precio).toBeGreaterThan(0);
      expect(await P.guardarBorrador(EQUIPO, r.presupuestoId, { items: vista.items }, deps)).toEqual({ ok: true });
      const guardados = versionesDe(r.presupuestoId)[0]!.items as { precioUnitario: number }[];
      expect(guardados[1]!.precioUnitario).toBe(precio);
    });

    it("si los ítems instanciados no validan (precio del catálogo sobre el tope), V1 vacía y el registro sólo lleva un código", async () => {
      B.datos.product.find((x) => x.id === "prod-a")!.priceArs = "99999999999999.00";
      conPropuesta([lista]);
      const r = await nuevo();
      expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ items: [] });
      expect(JSON.stringify(errores.mock.calls)).toContain("ITEMS_INVALIDOS");
    });

    it("sin condiciones en la propuesta, salen las de los ajustes", async () => {
      await A.guardarAjustes(DUENO, { validezDias: 15, condiciones: "Generales", propuestaPago: null, seguimientoDias: 3, seguimientoActivo: false });
      conPropuesta([lista], null);
      const r = await nuevo();
      expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ terms: "Generales" });
    });

    it("con una consulta nueva usa la categoría elegida", async () => {
      B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: SLUG_DNX });
      await asegurarCatalogosDelWorkspace("ws-1");
      const cat = B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === "ws-1")!.id as string;
      B.agregar("fotofficePropuestaModelo", { workspaceId: "ws-1", categoryId: cat, items: [lista], terms: null, autoSendOnWeb: false });
      const r = await P.crearPresupuesto(DUENO, { nuevaConsulta: { contacto: { nombre: "Nora Gil", email: "nora@x.test" }, categoriaId: cat } }, deps);
      if (!r.ok) throw new Error(r.error);
      expect((versionesDe(r.presupuestoId)[0]!.items as unknown[]).length).toBe(1);
    });

    it("producto inactivo: V1 vacía y el alta sigue bien", async () => {
      B.datos.product.find((x) => x.id === "prod-a")!.isActive = false;
      conPropuesta([lista]);
      const r = await nuevo();
      expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ items: [] });
    });

    it("CALCULO sin perfil: V1 vacía", async () => {
      conPropuesta([calculado]);
      const r = await nuevo();
      expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ items: [] });
    });

    it("sin propuesta para la categoría: V1 vacía", async () => {
      const r = await nuevo();
      expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ items: [] });
    });

    it("si leer la propuesta lanza, V1 vacía y el registro sólo lleva un código", async () => {
      conPropuesta([lista]);
      const original = B.tablas.fotofficePropuestaModelo.findFirst;
      B.tablas.fotofficePropuestaModelo.findFirst = async () => {
        throw Object.assign(new Error("Laura Pérez"), { code: "P1001" });
      };
      try {
        const r = await nuevo();
        expect(versionesDe(r.presupuestoId)[0]).toMatchObject({ items: [] });
        expect(JSON.stringify(errores.mock.calls)).toContain("P1001");
      } finally {
        B.tablas.fotofficePropuestaModelo.findFirst = original;
      }
    });
  });

  it("una consulta de otro workspace (o inexistente) no existe", async () => {
    expect(await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-9" }, deps)).toEqual({ ok: false, error: M.consulta });
    expect(await P.crearPresupuesto(OTRO, { consultaLeadId: "lead-1" }, deps)).toEqual({ ok: false, error: M.consulta });
    expect(B.datos.fotofficePresupuesto).toHaveLength(0);
  });

  it("sin consulta, la crea con el alta de siempre (MANUAL) y su contacto", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: SLUG_DNX });
    await asegurarCatalogosDelWorkspace("ws-1");
    const categoriaId = B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === "ws-1" && c.name === "Boda")!.id as string;
    const leadsAntes = B.datos.serviceSalesLead.length;
    const r = await P.crearPresupuesto(DUENO, { nuevaConsulta: { contacto: { nombre: "Laura Gómez", email: "laura@persona.test" }, categoriaId } }, deps);
    if (!r.ok) throw new Error(r.error);
    expect(B.datos.serviceSalesLead).toHaveLength(leadsAntes + 1);
    const ficha = B.datos.fotofficeConsulta.find((c) => c.leadId === r.leadId)!;
    expect(ficha).toMatchObject({ workspaceId: "ws-1" });
    expect(presupuesto(r.presupuestoId)).toMatchObject({ consultaLeadId: r.leadId, clientId: ficha.clientId });
    expect(H.numerar).toHaveBeenCalled();
  });

  it("si el presupuesto falla después de crear la consulta, devuelve la consulta creada (y registra sólo el código)", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: SLUG_DNX });
    await asegurarCatalogosDelWorkspace("ws-1");
    const categoriaId = B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === "ws-1" && c.name === "Boda")!.id as string;
    const original = B.tablas.fotofficePresupuesto.create;
    B.tablas.fotofficePresupuesto.create = async () => {
      throw Object.assign(new Error("Laura Gómez rompió todo"), { code: "P2003" });
    };
    try {
      const r = await P.crearPresupuesto(DUENO, { nuevaConsulta: { contacto: { nombre: "Laura Gómez", email: "laura@persona.test" }, categoriaId } }, deps);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error).toBe(M.falloConConsulta);
      expect(B.datos.serviceSalesLead.some((l) => l.id === r.leadId)).toBe(true);
      expect(errores.mock.calls.at(-1)?.[1]).toEqual({ codigo: "P2003" });
      // De una consulta elegida no hay consulta creada que devolver.
      const r2 = await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-1" }, deps);
      expect(r2).toEqual({ ok: false, error: M.fallo });
    } finally {
      B.tablas.fotofficePresupuesto.create = original;
    }
  });

  it("sin consulta ni contacto, o un contacto existente sin permiso de Clientes, no crea nada", async () => {
    expect(await P.crearPresupuesto(DUENO, {}, deps)).toEqual({ ok: false, error: M.elegirConsulta });
    const sinClientes = { ...EQUIPO, acceso: { role: "STAFF", levels: { quotes: "MANAGE", "service-leads": "MANAGE" } } as never };
    expect(await P.crearPresupuesto(sinClientes, { nuevaConsulta: { contacto: { clientId: "cli-lead-1" }, categoriaId: "cat" } }, deps))
      .toEqual({ ok: false, error: M.sinContactos });
    expect(B.datos.fotofficePresupuesto).toHaveLength(0);
  });

  it("otro responsable tiene que ser del equipo con Gestionar en Presupuestos", async () => {
    expect(await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-1", ownerUserId: 50 }, deps)).toEqual({ ok: false, error: M.responsable });
    B.agregar("workspaceMembership", { userId: 50, workspaceId: "ws-1" });
    H.nivel.mockResolvedValueOnce(false);
    expect(await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-1", ownerUserId: 50 }, deps)).toEqual({ ok: false, error: M.responsable });
    const r = await P.crearPresupuesto(DUENO, { consultaLeadId: "lead-1", ownerUserId: 50 }, deps);
    expect(r.ok && presupuesto(r.presupuestoId).ownerUserId).toBe(50);
  });

  it("con sólo Ver en Presupuestos no se crea", async () => {
    expect(await P.crearPresupuesto(LECTOR, { consultaLeadId: "lead-1" }, deps)).toEqual({ ok: false, error: M.sinPermiso });
  });
});

describe("borrador", () => {
  it("guarda ítems, descuentos y textos con totales y costos calculados en el servidor", async () => {
    B.agregar("product", { id: "p1", workspaceId: "ws-1", name: "Álbum", priceArs: "1000.00", costArs: "400.00" });
    B.agregar("product", { id: "p2", workspaceId: "ws-1", name: "Cobertura", priceArs: "5000.00" });
    B.agregar("fotofficeCostoPlantilla", { workspaceId: "ws-1", productId: "p2", concept: "Asistente", amountArs: "100.00", perUnit: false });
    B.agregar("fotofficeCostoPlantilla", { workspaceId: "ws-1", productId: "p2", concept: "Viáticos", amountArs: "50.00", perUnit: true });
    const { presupuestoId } = await nuevo();
    const r = await P.guardarBorrador(DUENO, presupuestoId, {
      items: [
        itemLista("a", { productId: "p1", cantidad: 2, descuento: { tipo: "PORCENTAJE", valor: 10 }, seccion: "Fiesta" }),
        itemLista("b", { productId: "p2", cantidad: 2, precioUnitario: 5000 }),
        itemLista("c", { precioUnitario: 300 }),
        itemLista("d", { precioUnitario: 999, opcional: true }),
      ],
      descuento: { tipo: "MONTO", valor: 800 },
      condiciones: " Seña 30 % ",
      propuestaPago: "",
    }, deps);
    expect(r).toEqual({ ok: true });
    const v = versionesDe(presupuestoId)[0]!;
    expect(v).toMatchObject({ terms: "Seña 30 %", paymentProposal: null });
    // 1800 + 10000 + 300 = 12100; menos 800 de descuento global.
    expect(v.totals).toMatchObject({ subtotal: 12300, descuentoItems: 200, descuentoGlobal: 800, total: 11300, descuento: { tipo: "MONTO", valor: 800 } });
    expect(v.costSnapshot).toMatchObject({
      porItem: {
        a: { costo: 800, origen: "COSTO_PRODUCTO" },
        b: { costo: 200, origen: "COSTOS_PLANTILLA" },
        c: { costo: null, origen: null },
      },
      costoTotal: 1000,
      itemsSinCosto: 1,
      margen: 10300,
    });
  });

  it("R2: un ítem de ¿Cuánto Cobro? se recalcula con el motor; la instantánea del navegador no cuenta", async () => {
    const { presupuestoId } = await nuevo();
    const trucho = { motor: "cuanto-cobro-core", costoBase: 1, margen: 999_999, precioSugerido: 5, entrada: entradaMotor() };
    expect(await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: trucho })] }, deps)).toEqual({ ok: true });
    const [item] = versionesDe(presupuestoId)[0]!.items as { precioUnitario: number; calculo: { costoBase: number; precioSugerido: number } }[];
    expect(item!.precioUnitario).toBe(SUGERIDO.precio);
    expect(item!.calculo.precioSugerido).toBe(SUGERIDO.precio);
    expect(item!.calculo.costoBase).toBe(SUGERIDO.minimo);
    expect((versionesDe(presupuestoId)[0]!.costSnapshot as { costoTotal: number }).costoTotal).toBe(SUGERIDO.minimo);
  });

  it("el precio de un ítem calculado se puede ajustar: manda el elegido y la instantánea guarda el sugerido", async () => {
    const { presupuestoId } = await nuevo();
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 123456.5, calculo: { entrada: entradaMotor() } })] }, deps);
    const [item] = versionesDe(presupuestoId)[0]!.items as { precioUnitario: number; calculo: { precioSugerido: number } }[];
    expect(item!.precioUnitario).toBe(123456.5);
    expect(item!.calculo.precioSugerido).toBe(SUGERIDO.precio);
  });

  it("sin entradas del cálculo (ni guardadas) o con entradas rotas, no se guarda", async () => {
    const { presupuestoId } = await nuevo();
    const r1 = await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", calculo: { precioMinimo: 1 } })] }, deps);
    expect(r1.ok === false && r1.error).toContain(M.calculoFaltante);
    const r2 = await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", calculo: { entrada: { perfil: 1 } } })] }, deps);
    expect(r2.ok === false && r2.error).toContain(M.calculoInvalido);
    expect(versionesDe(presupuestoId)[0]!.items).toEqual([]);
  });

  it("quien no ve costos recibe los ítems sin el cálculo y, al guardarlos, se recalculan con las entradas guardadas", async () => {
    const { presupuestoId } = await nuevo();
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: entradaMotor() } })] }, deps);
    const vista = await P.leerPresupuesto(EQUIPO, presupuestoId, deps);
    const items = vista!.borrador!.items;
    expect(items[0]).toMatchObject({ modoPrecio: "CALCULO", calculo: null });
    expect(await P.guardarBorrador(EQUIPO, presupuestoId, { items: items.map((i) => ({ ...i, cantidad: 2 })) }, deps)).toEqual({ ok: true });
    const [item] = versionesDe(presupuestoId)[0]!.items as { cantidad: number; precioUnitario: number; calculo: { costoBase: number; unidades: number } | null }[];
    // Cantidad 2 del navegador = el renglón por 2, guardado como cantidad 1 con el precio entero.
    expect(item).toMatchObject({ cantidad: 1, precioUnitario: Math.round(SUGERIDO.precio * 2 * 100) / 100 });
    expect(item!.calculo).toMatchObject({ costoBase: SUGERIDO.minimo, unidades: 2 });
  });

  it("R4: sin configurar no se carga ni se cambia un cálculo (el navegador no puede colar entradas)", async () => {
    const { presupuestoId } = await nuevo();
    // Un ítem calculado nuevo, armado por alguien del equipo: no tiene entrada guardada y no pasa.
    const r = await P.guardarBorrador(EQUIPO, presupuestoId, { items: [itemLista("n", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: entradaMotor() } })] }, deps);
    expect(r.ok === false && r.error).toContain(M.calculoFaltante);
    // Uno existente: la entrada que manda se ignora y se usa la guardada.
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: entradaMotor() } })] }, deps);
    const otra = entradaMotor();
    otra.presupuesto = { ...otra.presupuesto, chosenPrice: "1" };
    expect(await P.guardarBorrador(TESORERIA, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: otra } })] }, deps)).toEqual({ ok: true });
    const [item] = versionesDe(presupuestoId)[0]!.items as { precioUnitario: number }[];
    expect(item!.precioUnitario).toBe(SUGERIDO.precio);
  });

  it("contrato del precio: la marca del editor manda; sin marca, igual al sugerido guardado = sigue al motor", async () => {
    const { presupuestoId } = await nuevo();
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: entradaMotor() } })] }, deps);
    const precioDe = () => (versionesDe(presupuestoId)[0]!.items as { precioUnitario: number }[])[0]!.precioUnitario;
    expect(precioDe()).toBe(SUGERIDO.precio);
    // Cambian las entradas (precio manual del motor) y el renglón llega con el precio viejo, sin
    // tocar: sigue al motor.
    const otra = entradaMotor();
    otra.presupuesto = { ...otra.presupuesto, chosenPrice: "333333" };
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: SUGERIDO.precio, calculo: { entrada: otra, precioAjustado: false } })] }, deps);
    expect(precioDe()).toBe(333333);
    // Sin marca y con el mismo precio que el sugerido guardado: también sigue al motor.
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 333333, calculo: { entrada: entradaMotor() } })] }, deps);
    expect(precioDe()).toBe(SUGERIDO.precio);
    // Con la marca, manda el precio elegido aunque coincida con otro valor.
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 4444, calculo: { entrada: entradaMotor(), precioAjustado: true } })] }, deps);
    expect(precioDe()).toBe(4444);
    // Quien no ve costos (sin marca) mantiene el ajuste: 4444 no es el sugerido guardado.
    await P.guardarBorrador(EQUIPO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 4444, calculo: null })] }, deps);
    expect(precioDe()).toBe(4444);
  });

  it("sin instantánea en el ítem que llega, las unidades salen de las guardadas", async () => {
    const { presupuestoId } = await nuevo();
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: entradaMotor(), unidades: 3 } })] }, deps);
    const unidades = () => (versionesDe(presupuestoId)[0]!.items as { calculo: { unidades: number } }[])[0]!.calculo.unidades;
    expect(unidades()).toBe(3);
    const items = (await P.leerPresupuesto(EQUIPO, presupuestoId, deps))!.borrador!.items;
    expect(await P.guardarBorrador(EQUIPO, presupuestoId, { items }, deps)).toEqual({ ok: true });
    expect(unidades()).toBe(3);
  });

  it("un producto de otro workspace no entra", async () => {
    B.agregar("product", { id: "ajeno", workspaceId: "ws-2", name: "Ajeno", priceArs: "1.00" });
    const { presupuestoId } = await nuevo();
    expect(await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("a", { productId: "ajeno" })] }, deps)).toEqual({ ok: false, error: M.producto });
  });
});

describe("versiones", () => {
  it("una versión enviada no se edita; editar crea la V2 (copia profunda) y la V1 sigue igual y vigente", async () => {
    const { presupuestoId, versionId: v1 } = await nuevo();
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("a")] }, deps);
    await enviar(presupuestoId);
    expect(await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("b")] }, deps)).toEqual({ ok: false, error: M.yaEnviado });

    const n = await V.crearNuevaVersion(DUENO, presupuestoId);
    expect(n).toMatchObject({ ok: true, number: 2, yaExistia: false });
    expect(await V.crearNuevaVersion(DUENO, presupuestoId)).toMatchObject({ ok: true, number: 2, yaExistia: true });
    expect(await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("b", { precioUnitario: 7 })] }, deps)).toEqual({ ok: true });

    const [primera, segunda] = [...versionesDe(presupuestoId)].sort((a, b) => (a.number as number) - (b.number as number));
    expect((primera!.items as { id: string }[]).map((i) => i.id)).toEqual(["a"]);
    expect((segunda!.items as { id: string }[]).map((i) => i.id)).toEqual(["b"]);
    expect(presupuesto(presupuestoId).currentVersionId).toBe(v1);

    // Al enviar la V2, el token de la V1 queda revocado.
    await enviar(presupuestoId);
    expect(versionesDe(presupuestoId).find((v) => v.id === v1)!.revokedAt).toEqual(AHORA);
    expect(presupuesto(presupuestoId).currentVersionId).toBe(segunda!.id);
  });

  it("si la envían mientras se guarda, el guardado no toca la versión enviada", async () => {
    const { presupuestoId, versionId } = await nuevo();
    await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("a")] }, deps);
    B.ganchos.alEjecutarSql = (texto) => {
      if (texto.includes("pg_advisory_xact_lock")) B.datos.fotofficePresupuestoVersion.find((v) => v.id === versionId)!.sentAt = AHORA;
    };
    expect(await P.guardarBorrador(DUENO, presupuestoId, { items: [itemLista("b")] }, deps)).toEqual({ ok: false, error: M.yaEnviado });
    expect((versionesDe(presupuestoId)[0]!.items as { id: string }[]).map((i) => i.id)).toEqual(["a"]);
    // Toma el candado del presupuesto.
    expect(B.sql.some((q) => q.valores[0] === `fotoffice-presupuesto:${presupuestoId}`)).toBe(true);
  });

  it("dos pestañas que piden la versión nueva a la vez reciben el mismo borrador", async () => {
    const { presupuestoId } = await nuevo();
    await enviar(presupuestoId);
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      B.ganchos.alEjecutarSql = null;
      // La otra pestaña ya creó la V2 cuando esta toma el candado.
      B.agregar("fotofficePresupuestoVersion", { id: "v2-otra", workspaceId: "ws-1", presupuestoId, number: 2, items: [], totals: {} });
    };
    expect(await V.crearNuevaVersion(DUENO, presupuestoId)).toEqual({ ok: true, versionId: "v2-otra", number: 2, yaExistia: true });
    expect(versionesDe(presupuestoId)).toHaveLength(2);
  });

  it("si la otra pestaña gana el número (P2002), se reintenta y se devuelve su borrador", async () => {
    const { presupuestoId } = await nuevo();
    await enviar(presupuestoId);
    const original = B.tablas.fotofficePresupuestoVersion.create;
    let creaciones = 0;
    B.tablas.fotofficePresupuestoVersion.create = async (...args: Parameters<typeof original>) => {
      creaciones += 1;
      if (creaciones === 1) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      return original(...args);
    };
    let candados = 0;
    B.ganchos.alEjecutarSql = (texto) => {
      if (!texto.includes("pg_advisory_xact_lock")) return;
      candados += 1;
      // Entre el primer intento (deshecho) y el reintento, la otra pestaña confirmó su V2.
      if (candados === 2) B.agregar("fotofficePresupuestoVersion", { id: "v2-ganadora", workspaceId: "ws-1", presupuestoId, number: 2, items: [], totals: {} });
    };
    expect(await V.crearNuevaVersion(DUENO, presupuestoId)).toEqual({ ok: true, versionId: "v2-ganadora", number: 2, yaExistia: true });
    B.tablas.fotofficePresupuestoVersion.create = original;
    expect(candados).toBe(2);
    expect(versionesDe(presupuestoId).map((v) => v.number).sort()).toEqual([1, 2]);
  });

  it("congelar es una sola vez", async () => {
    const { versionId } = await nuevo();
    const congelar = () => (B.prisma.$transaction as (fn: (tx: never) => Promise<boolean>) => Promise<boolean>)((tx) => V.congelarVersion(tx, { workspaceId: "ws-1", versionId, ahora: AHORA }));
    expect(await congelar()).toBe(true);
    expect(await congelar()).toBe(false);
  });

  it("un presupuesto aceptado no se edita ni versiona", async () => {
    const { presupuestoId } = await nuevo();
    await enviar(presupuestoId);
    presupuesto(presupuestoId).status = "ACEPTADO";
    expect(await V.crearNuevaVersion(DUENO, presupuestoId)).toEqual({ ok: false, error: M.aceptado });
    expect(await P.guardarBorrador(DUENO, presupuestoId, { items: [] }, deps)).toEqual({ ok: false, error: M.aceptado });
  });
});

describe("estados", () => {
  it("rechazar: no desde borrador; sí desde enviado; una sola vez", async () => {
    const { presupuestoId } = await nuevo();
    expect(await P.rechazarPresupuesto(DUENO, presupuestoId, deps)).toEqual({ ok: false, error: M.transicion });
    await enviar(presupuestoId);
    expect(await P.rechazarPresupuesto(DUENO, presupuestoId, deps)).toEqual({ ok: true });
    expect(presupuesto(presupuestoId).status).toBe("RECHAZADO");
    expect(await P.rechazarPresupuesto(DUENO, presupuestoId, deps)).toEqual({ ok: false, error: M.transicion });
  });

  it("VENCIDO se calcula al leer (el último día todavía vale) y el lote lo escribe sólo en el workspace", async () => {
    const { presupuestoId } = await nuevo();
    await enviar(presupuestoId);
    const ajeno = B.agregar("fotofficePresupuesto", { workspaceId: "ws-2", consultaLeadId: "lead-9", clientId: "cli-lead-9", status: "ENVIADO", validUntil: new Date("2026-01-01") });
    presupuesto(presupuestoId).validUntil = new Date("2026-10-07T00:00:00.000Z");
    expect((await P.leerPresupuesto(DUENO, presupuestoId, deps))!.estado).toBe("ENVIADO");
    presupuesto(presupuestoId).validUntil = new Date("2026-10-06T00:00:00.000Z");
    expect((await P.leerPresupuesto(DUENO, presupuestoId, deps))).toMatchObject({ estado: "VENCIDO", estadoGuardado: "ENVIADO" });
    expect((await P.listarPresupuestos(DUENO, { estado: "VENCIDO" }, deps)).map((f) => f.id)).toEqual([presupuestoId]);
    expect(await P.listarPresupuestos(DUENO, { estado: "ENVIADO" }, deps)).toEqual([]);

    expect(await P.marcarVencidos(DUENO, undefined, deps)).toEqual({ ok: true, marcados: 1 });
    expect(presupuesto(presupuestoId).status).toBe("VENCIDO");
    expect(ajeno.status).toBe("ENVIADO");
    // Vencido: se puede rechazar, no aceptar.
    expect(await P.rechazarPresupuesto(DUENO, presupuestoId, deps)).toEqual({ ok: true });
  });

  it("marcar vencidos con ids de otro workspace no toca nada", async () => {
    const ajeno = B.agregar("fotofficePresupuesto", { workspaceId: "ws-2", consultaLeadId: "lead-9", clientId: "cli-lead-9", status: "ENVIADO", validUntil: new Date("2026-01-01") });
    expect(await P.marcarVencidos(DUENO, [ajeno.id], deps)).toEqual({ ok: true, marcados: 0 });
    expect(await P.marcarVencidos(DUENO, "x", deps)).toEqual({ ok: false, error: M.datosInvalidos });
  });

  it("enviar renueva la validez (datosDeEnvio); sin ella no pasa a ENVIADO, y un vencido o rechazado se reenvía con la fecha nueva", async () => {
    const { presupuestoId } = await nuevo();
    await enviar(presupuestoId);
    expect(presupuesto(presupuestoId).validUntil).toEqual(new Date("2026-10-22T00:00:00.000Z"));
    // Un mes después está vencido; versión nueva y reenvío.
    const despues = new Date("2026-11-20T15:00:00.000Z");
    expect((await P.leerPresupuesto(DUENO, presupuestoId, { ahora: () => despues }))!.estado).toBe("VENCIDO");
    await V.crearNuevaVersion(DUENO, presupuestoId);
    // Sin la validez renovada (o con una ya pasada) no se envía.
    expect(await P.pasarEstado(B.prisma as never, { workspaceId: "ws-1", presupuestoId, a: "ENVIADO", ahora: despues })).toEqual({ ok: false, error: M.transicion });
    expect(
      await P.pasarEstado(B.prisma as never, { workspaceId: "ws-1", presupuestoId, a: "ENVIADO", ahora: despues, datos: { validUntil: new Date("2026-11-01T00:00:00.000Z") } }),
    ).toEqual({ ok: false, error: M.transicion });
    await enviar(presupuestoId, despues);
    expect(presupuesto(presupuestoId)).toMatchObject({ status: "ENVIADO", validUntil: new Date("2026-12-05T00:00:00.000Z") });
    expect((await P.leerPresupuesto(DUENO, presupuestoId, { ahora: () => despues }))!.estado).toBe("ENVIADO");
    // Rechazado → ENVIADO, también con la fecha nueva.
    expect(await P.rechazarPresupuesto(DUENO, presupuestoId, { ahora: () => despues })).toEqual({ ok: true });
    expect(P.datosDeEnvio(despues, { validezDias: 3 })).toEqual({ validUntil: new Date("2026-11-23T00:00:00.000Z") });
  });

  it("los filtros de la tarjeta sólo aceptan ids de texto", async () => {
    await nuevo();
    expect(await P.listarPresupuestos(DUENO, { consultaLeadId: { not: "x" } as never }, deps)).toHaveLength(1);
    expect(await P.listarPresupuestos(DUENO, { clientId: "cli-lead-1" }, deps)).toHaveLength(1);
    expect(await P.listarPresupuestos(DUENO, { clientId: "otro" }, deps)).toHaveLength(0);
  });

  it("número PRESUPUESTO: se asigna una vez", async () => {
    const { presupuestoId } = await nuevo();
    const numerar = () => (B.prisma.$transaction as (fn: (tx: never) => Promise<{ value: number; display: string }>) => Promise<{ value: number; display: string }>)((tx) =>
      P.numerarPresupuesto(tx, { workspaceId: "ws-1", presupuestoId, fecha: AHORA }));
    const a = await numerar();
    const b = await numerar();
    expect(a.value).toBe(1);
    expect(b).toEqual(a);
    expect((await P.leerPresupuesto(DUENO, presupuestoId, deps))!.numero).toBe(a.display);
  });
});

describe("aislamiento y costos", () => {
  it("otro workspace no lee, no edita, no versiona ni rechaza", async () => {
    const { presupuestoId } = await nuevo();
    await enviar(presupuestoId);
    expect(await P.leerPresupuesto(OTRO, presupuestoId, deps)).toBeNull();
    expect(await P.listarPresupuestos(OTRO, {}, deps)).toEqual([]);
    expect(await P.guardarBorrador(OTRO, presupuestoId, { items: [] }, deps)).toEqual({ ok: false, error: M.noExiste });
    expect(await V.crearNuevaVersion(OTRO, presupuestoId)).toEqual({ ok: false, error: M.noExiste });
    expect(await P.rechazarPresupuesto(OTRO, presupuestoId, deps)).toEqual({ ok: false, error: M.noExiste });
    expect(presupuesto(presupuestoId).status).toBe("ENVIADO");
  });

  it("costo y margen: sólo el dueño (configurar); el equipo, quien sólo ve y Tesorería, nunca (ni en el JSON)", async () => {
    B.agregar("product", { id: "p1", workspaceId: "ws-1", name: "Álbum", priceArs: "1000.00", costArs: "400.00" });
    const { presupuestoId } = await nuevo();
    await P.guardarBorrador(DUENO, presupuestoId, {
      items: [itemLista("a", { productId: "p1" }), itemLista("x", { modoPrecio: "CALCULO", precioUnitario: 0, calculo: { entrada: entradaMotor() } })],
    }, deps);

    const delDueno = await P.leerPresupuesto(DUENO, presupuestoId, deps);
    expect(delDueno!.veCostos).toBe(true);
    expect(delDueno!.vigente!.costos).toMatchObject({ costoTotal: 400 + SUGERIDO.minimo });
    expect((await P.listarPresupuestos(DUENO, {}, deps))[0]).toMatchObject({ costo: 400 + SUGERIDO.minimo });

    expect(puede((TESORERIA as { acceso: AccesoEfectivo }).acceso, "verDinero")).toBe(true);
    for (const ctx of [EQUIPO, LECTOR, TESORERIA]) {
      const d = await P.leerPresupuesto(ctx, presupuestoId, deps);
      const l = await P.listarPresupuestos(ctx, {}, deps);
      expect(d!.veCostos).toBe(false);
      expect(d!.vigente!.costos).toBeNull();
      expect(l[0]).toMatchObject({ costo: null, margen: null, total: 1000 + SUGERIDO.precio });
      const json = JSON.stringify([d, l]);
      for (const prohibido of ["precioMinimo", "costoBase", "margenElegido", "costoTotal", "costoHumano", "margenProporcion", "entrada", "perfil"]) {
        expect(json).not.toContain(prohibido);
      }
    }
  });

  it("tarjetas: filtro por consulta y por contacto dentro del workspace", async () => {
    const { presupuestoId } = await nuevo();
    expect((await P.listarPresupuestos(DUENO, { consultaLeadId: "lead-1" }, deps)).map((f) => f.id)).toEqual([presupuestoId]);
    expect((await P.listarPresupuestos(DUENO, { clientId: "cli-lead-1" }, deps))[0]).toMatchObject({ contacto: "Laura Pérez", validUntil: "2026-10-22", estado: "BORRADOR" });
    expect(await P.listarPresupuestos(DUENO, { consultaLeadId: "lead-9" }, deps)).toEqual([]);
  });
});

describe("ajustes", () => {
  it("de fábrica sin fila; guardar exige configurar y valida los rangos", async () => {
    expect(await A.leerAjustes("ws-1")).toEqual(A.AJUSTES_DE_FABRICA);
    expect(A.AJUSTES_DE_FABRICA).toMatchObject({ validezDias: 15, seguimientoDias: 3, seguimientoActivo: false });
    const datos = { validezDias: 20, condiciones: "", propuestaPago: null, seguimientoDias: 5, seguimientoActivo: true };
    expect(await A.guardarAjustes(EQUIPO, datos)).toEqual({ ok: false, error: M.sinPermisoAjustes });
    expect(await A.guardarAjustes(DUENO, { ...datos, validezDias: 0 })).toMatchObject({ ok: false });
    expect(await A.guardarAjustes(DUENO, { ...datos, seguimientoDias: 91 })).toMatchObject({ ok: false });
    expect(await A.guardarAjustes(DUENO, datos)).toEqual({ ok: true });
    expect(await A.guardarAjustes(DUENO, { ...datos, validezDias: 25 })).toEqual({ ok: true });
    expect(B.datos.fotofficePresupuestoAjustes).toHaveLength(1);
    expect(await A.leerAjustes("ws-1")).toEqual({ validezDias: 25, condiciones: null, propuestaPago: null, seguimientoDias: 5, seguimientoActivo: true });
    expect(await A.leerAjustes("ws-2")).toEqual(A.AJUSTES_DE_FABRICA);
  });

  it("semilla de DNX: 15 días y seguimiento a 3 (apagado), sólo si falta y sólo para DNX", async () => {
    expect(await S.asegurarAjustesDnx("ws-2", "otra")).toBe(false);
    expect(await S.asegurarAjustesDnx("ws-1", SLUG_DNX)).toBe(true);
    expect(await S.asegurarAjustesDnx("ws-1", SLUG_DNX)).toBe(false);
    expect(B.datos.fotofficePresupuestoAjustes).toHaveLength(1);
    expect(B.datos.fotofficePresupuestoAjustes[0]).toMatchObject({ workspaceId: "ws-1", validityDays: 15, followUpDays: 3, followUpEnabled: false });
  });
});

describe("fuente", () => {
  const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

  it("las acciones: 'use server', sólo funciones async, forma → contexto, y nunca devuelven lecturas con costos", () => {
    const src = leer("app/actions/presupuestos.ts");
    expect(src.startsWith('"use server";')).toBe(true);
    const exportados = src.match(/^export .*/gm) ?? [];
    expect(exportados.every((l) => l.startsWith("export async function"))).toBe(true);
    for (const cuerpo of src.split("export async function").slice(1)) {
      const forma = cuerpo.indexOf("return INVALIDO");
      const contexto = cuerpo.indexOf("contextoDePresupuestos(");
      expect(contexto).toBeGreaterThan(-1);
      expect(forma).toBeLessThan(contexto);
    }
    expect(src).not.toMatch(/leerPresupuesto|listarPresupuestos|@repo\/db/);
  });

  it("la guarda: sesión, workspace de la sesión, módulo quotes encendido y nivel", () => {
    const src = leer("lib/presupuestos/contexto.ts");
    const orden = ["getAuthUser(", "resolveActiveWorkspace(", "isModuleEnabledForWorkspace(", "puede(acceso, nivel, QUOTES_MODULE_KEY)"];
    const pos = orden.map((s) => src.indexOf(s));
    expect(pos.every((p) => p > -1)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });
});
