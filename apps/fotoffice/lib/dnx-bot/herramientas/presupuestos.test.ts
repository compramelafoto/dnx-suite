import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import type { BotTool } from "@repo/dnx-bot";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ nivel: vi.fn(async () => true) }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));

const { herramientasDePresupuestos, CAMBIO_EL_CALCULO } = await import("./presupuestos");
const P = await import("@/lib/presupuestos/presupuestos");
type CtxBot = import("../acceso").CtxBot;

const AHORA = new Date("2026-10-12T15:00:00.000Z");
const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const ctx = (configurar: boolean, levels: Record<string, string> = niveles): CtxBot => ({
  workspaceId: "ws-1",
  workspaceNombre: "DNX Estudio",
  userId: configurar ? 1 : 2,
  userLabel: "X",
  role: configurar ? "WORKSPACE_OWNER" : "STAFF",
  acceso: { role: configurar ? "WORKSPACE_OWNER" : "STAFF", levels } as never,
  email: "x@y.test",
  nombre: "X",
  capacidades: { configurar, gestionarPresupuestos: levels.quotes === "MANAGE", verConsultas: (levels["service-leads"] ?? "NONE") !== "NONE" },
  plataforma: "FOTOFFICE:ws-1",
});
const DUENO = ctx(true);
const actor = { userId: 1, role: "WORKSPACE_OWNER", email: "x@y.test", name: "X" };

let perfil: ReturnType<typeof createBaseCompleteProfile> | null = createBaseCompleteProfile();
let clave = 0;
let modelo = 0;
const deps = {
  leerPerfil: async () => (perfil ? { perfil, source: "manual", actualizado: AHORA } : null),
  ahora: () => AHORA,
  nuevaClave: () => `k${++clave}`,
  itemsDePropuestaModelo: async () => modelo,
};
const herramientas = (c: CtxBot = DUENO) => herramientasDePresupuestos(c, deps);
const tool = (n: string, c?: CtxBot): BotTool => herramientas(c).find((t) => t.name === n)!;

const BODA = {
  tipoDeTrabajo: "Casamiento",
  conceptos: [
    { nombre: "Cobertura", horasCobertura: "8", horasEdicion: "20", horasViaje: "2", horasCliente: "3" },
    { nombre: "Álbum", tipo: "physical-product" as const, costoProveedor: "180000", margenDeseado: "30" },
  ],
};

function consulta(leadId: string, opciones: { ficha?: boolean } = {}) {
  B.agregar("serviceSalesLead", { id: leadId, workspaceId: "ws-1", name: "Lucía Gómez", eventType: "BODA", eventDate: new Date("2026-11-15T00:00:00Z") });
  B.agregar("fotofficeRecordNumber", { workspaceId: "ws-1", entityType: "CONSULTA", entityId: leadId, display: "12" });
  if (opciones.ficha === false) return;
  B.agregar("client", { id: `cli-${leadId}`, workspaceId: "ws-1", kind: "PERSONA", firstName: "Lucía", lastName: "Gómez", businessName: null });
  if (!B.datos.fotofficeConsultaCategoria.some((c) => c.id === "cat-bodas")) {
    B.agregar("fotofficeConsultaCategoria", { id: "cat-bodas", workspaceId: "ws-1", name: "Bodas", group: "Sociales" });
  }
  B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId, clientId: `cli-${leadId}`, categoryId: "cat-bodas" });
}

async function cotizado(c = BODA): Promise<{ total: string; data: Record<string, unknown> }> {
  const r = await tool("cotizar_trabajo").run(c, actor);
  const data = (r as { data: Record<string, unknown> }).data;
  return { total: data.totalParaConfirmar as string, data };
}

const presupuestosDe = (leadId: string) => B.datos.fotofficePresupuesto.filter((p) => p.consultaLeadId === leadId);
const borradorDe = (id: string) => B.datos.fotofficePresupuestoVersion.find((v) => v.presupuestoId === id && v.sentAt === null)!;

beforeEach(() => {
  B.vaciar();
  perfil = createBaseCompleteProfile();
  clave = 0;
  modelo = 0;
  H.nivel.mockResolvedValue(true);
});

describe("quién recibe qué", () => {
  it("dueño: todas; STAFF que gestiona sin configurar: sólo ver_presupuesto; COLLABORATOR: sin buscador", () => {
    expect(herramientas().map((t) => t.name)).toEqual(["cotizar_trabajo", "buscar_consultas", "ver_presupuesto", "crear_borrador_de_presupuesto", "sumar_al_borrador"]);
    expect(herramientas(ctx(false)).map((t) => t.name)).toEqual(["ver_presupuesto"]);
    expect(herramientas({ ...DUENO, role: "COLLABORATOR" }).map((t) => t.name)).not.toContain("buscar_consultas");
    expect(herramientas({ ...DUENO, capacidades: { ...DUENO.capacidades, gestionarPresupuestos: false } }).map((t) => t.name)).not.toContain("crear_borrador_de_presupuesto");
  });
});

describe("cotizar_trabajo", () => {
  it("devuelve el resumen formateado, la tarjeta y el total para confirmar; no escribe nada", async () => {
    const { data, total } = await cotizado();
    expect(data.estado).toBe("OK");
    expect(total).toMatch(/^\d+$/);
    expect((data.tarjeta as { titulo: string }).titulo).toBe("¿Cuánto cobro? · Casamiento");
    expect(B.datos.fotofficePresupuesto).toHaveLength(0);
  });
  it("sin perfil completo no da precio y manda a Configuración → Precios", async () => {
    perfil = null;
    const r = await tool("cotizar_trabajo").run(BODA, actor);
    expect((r as { data: unknown }).data).toMatchObject({ estado: "PERFIL_INCOMPLETO", ruta: "/workspace/configuracion/precios" });
    expect(r.message).toMatch(/no hay precio/);
  });
});

describe("crear_borrador_de_presupuesto", () => {
  it("describe con la consulta, los ítems y el total; avisa que reemplaza la propuesta modelo y que no se deshace", async () => {
    consulta("l1");
    modelo = 3;
    const { total } = await cotizado();
    const s = await tool("crear_borrador_de_presupuesto").describe!({ ...BODA, consultaLeadId: "l1", totalEsperado: total }, actor);
    expect(s).toMatch(/^Crear el borrador del presupuesto de la consulta N\.º 12 \(Bodas · 15\/11\/2026\) con 2 ítems: Cobertura \$.* · Álbum \$/);
    expect(s).toContain("Reemplaza los 3 ítems de la propuesta modelo.");
    expect(s).toContain("Esto no se deshace desde acá.");
    expect(B.datos.fotofficePresupuesto).toHaveLength(0);
  });

  it("al confirmar: crea el presupuesto y deja en el borrador exactamente los ítems calculados", async () => {
    consulta("l1");
    const { total } = await cotizado();
    const r = await tool("crear_borrador_de_presupuesto").run({ ...BODA, consultaLeadId: "l1", totalEsperado: total }, actor);
    expect(r.ok).toBe(true);
    const [p] = presupuestosDe("l1");
    const items = borradorDe(p!.id as string).items as { nombre: string; modoPrecio: string; precioUnitario: number }[];
    expect(items.map((i) => [i.nombre, i.modoPrecio])).toEqual([["Cobertura", "CALCULO"], ["Álbum", "CALCULO"]]);
    expect(String(Math.round(items.reduce((s, i) => s + i.precioUnitario, 0)))).toBe(total);
    expect(r.message).toContain(`/presupuestos/${p!.id}`);
  });

  it("si el cálculo cambió desde que se mostró (otro perfil), no propone ni guarda", async () => {
    consulta("l1");
    const { total } = await cotizado();
    perfil = createBaseCompleteProfile({ businessRent: "500000" });
    await expect(tool("crear_borrador_de_presupuesto").describe!({ ...BODA, consultaLeadId: "l1", totalEsperado: total }, actor)).rejects.toThrow(CAMBIO_EL_CALCULO);
    expect(await tool("crear_borrador_de_presupuesto").run({ ...BODA, consultaLeadId: "l1", totalEsperado: total }, actor)).toEqual({ ok: false, message: CAMBIO_EL_CALCULO });
    expect(B.datos.fotofficePresupuesto).toHaveLength(0);
  });

  it("consulta sin contacto: explica y manda a completarla", async () => {
    consulta("l1", { ficha: false });
    const { total } = await cotizado();
    await expect(tool("crear_borrador_de_presupuesto").describe!({ ...BODA, consultaLeadId: "l1", totalEsperado: total }, actor)).rejects.toThrow(/todavía no tiene contacto.*\/consultas\/l1/);
  });

  it("consulta que ya tiene borrador: manda a sumar_al_borrador", async () => {
    consulta("l1");
    const creado = await P.crearPresupuesto(DUENO, { consultaLeadId: "l1" }, { ahora: () => AHORA });
    if (!creado.ok) throw new Error(creado.error);
    const { total } = await cotizado();
    await expect(tool("crear_borrador_de_presupuesto").describe!({ ...BODA, consultaLeadId: "l1", totalEsperado: total }, actor)).rejects.toThrow(
      new RegExp(`sumar_al_borrador con presupuestoId ${creado.presupuestoId}`),
    );
  });

  it("consulta de otro workspace o inexistente: no existe", async () => {
    const { total } = await cotizado();
    await expect(tool("crear_borrador_de_presupuesto").describe!({ ...BODA, consultaLeadId: "nada", totalEsperado: total }, actor)).rejects.toThrow("No encontramos esa consulta.");
  });
});

describe("sumar_al_borrador", () => {
  async function conBorrador() {
    consulta("l1");
    const creado = await P.crearPresupuesto(DUENO, { consultaLeadId: "l1" }, { ahora: () => AHORA });
    if (!creado.ok) throw new Error(creado.error);
    const lista = { id: "a", productId: null, nombre: "Impresiones", descripcion: null, cantidad: 1, precioUnitario: 1000, descuento: null, modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false };
    const g = await P.guardarBorrador(DUENO, creado.presupuestoId, { items: [lista], condiciones: "Seña del 30 %." }, { ahora: () => AHORA });
    if (!g.ok) throw new Error(g.error);
    return creado.presupuestoId;
  }

  it("suma sin tocar lo que había (ítems y condiciones) y se puede deshacer", async () => {
    const id = await conBorrador();
    const { total } = await cotizado();
    const s = await tool("sumar_al_borrador").describe!({ ...BODA, presupuestoId: id, totalEsperado: total }, actor);
    expect(s).toMatch(/El total pasa de \$\s?1\.000 a \$/);
    const r = await tool("sumar_al_borrador").run({ ...BODA, presupuestoId: id, totalEsperado: total }, actor);
    expect(r.ok).toBe(true);
    const v = borradorDe(id);
    expect((v.items as { nombre: string }[]).map((i) => i.nombre)).toEqual(["Impresiones", "Cobertura", "Álbum"]);
    expect(v.terms).toBe("Seña del 30 %.");
    const u = await tool("sumar_al_borrador").undo!((r as { before: unknown }).before, actor);
    expect(u.ok).toBe(true);
    expect((borradorDe(id).items as { nombre: string }[]).map((i) => i.nombre)).toEqual(["Impresiones"]);
    expect(borradorDe(id).terms).toBe("Seña del 30 %.");
  });

  it("deshacer no pisa un cambio hecho después en el editor", async () => {
    const id = await conBorrador();
    const { total } = await cotizado();
    const r = await tool("sumar_al_borrador").run({ ...BODA, presupuestoId: id, totalEsperado: total }, actor);
    await P.guardarBorrador(DUENO, id, { items: [] }, { ahora: () => AHORA });
    const u = await tool("sumar_al_borrador").undo!((r as { before: unknown }).before, actor);
    expect(u).toEqual({ ok: false, message: "El borrador cambió después: deshacelo desde el editor." });
  });

  it("presupuesto sin borrador (aceptado) o ajeno: no se toca", async () => {
    const id = await conBorrador();
    B.datos.fotofficePresupuesto.find((p) => p.id === id)!.status = "ACEPTADO";
    const { total } = await cotizado();
    await expect(tool("sumar_al_borrador").describe!({ ...BODA, presupuestoId: id, totalEsperado: total }, actor)).rejects.toThrow(/No hay un borrador para editar/);
    await expect(tool("sumar_al_borrador").describe!({ ...BODA, presupuestoId: "otro", totalEsperado: total }, actor)).rejects.toThrow("No encontramos ese presupuesto.");
  });
});

describe("ver_presupuesto", () => {
  it("con costos para el dueño; sin ganancia para quien no configura", async () => {
    consulta("l1");
    const { total } = await cotizado();
    await tool("crear_borrador_de_presupuesto").run({ ...BODA, consultaLeadId: "l1", totalEsperado: total }, actor);
    const [p] = presupuestosDe("l1");
    const dueno = (await tool("ver_presupuesto").run({ presupuestoId: p!.id }, actor)) as { data: { items: { ganancia?: string }[]; esBorrador: boolean } };
    expect(dueno.data.esBorrador).toBe(true);
    expect(dueno.data.items[0]!.ganancia).toMatch(/\$/);
    const staff = (await tool("ver_presupuesto", ctx(false)).run({ presupuestoId: p!.id }, actor)) as { data: { items: Record<string, unknown>[] } };
    expect(staff.data.items[0]).not.toHaveProperty("ganancia");
  });
});
