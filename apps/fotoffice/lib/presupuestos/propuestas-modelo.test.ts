import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

const PM = await import("./propuestas-modelo");
const M = PM.MENSAJES_PROPUESTA_MODELO;

const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
const EQUIPO = { workspaceId: "ws-1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: niveles } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };

const item = (id: string, productId: string | null = "prod-1", datos: Record<string, unknown> = {}) => ({
  id, productId, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: 1000, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
});

const concepto = (id: string, datos: Record<string, unknown> = {}) => ({
  id, productId: null, nombre: `Concepto ${id}`, descripcion: null, cantidad: 1, precioUnitario: 0, descuento: null,
  modoPrecio: "CALCULO", calculo: { entrada: { presupuesto: { concepts: [{ name: "Cobertura", itemType: "own-service" }] } } },
  seccion: null, opcional: false, ...datos,
});

let plantillaId = "";
beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeConsultaCategoria", { id: "cat-boda", workspaceId: "ws-1", name: "Boda", group: "Social", order: 1 });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-15", workspaceId: "ws-1", name: "15 años", group: "Social", order: 2 });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-vieja", workspaceId: "ws-1", name: "Vieja", group: "Social", archivedAt: new Date() });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-ajena", workspaceId: "ws-2", name: "Boda", group: "Social" });
  B.agregar("product", { id: "prod-1", workspaceId: "ws-1", name: "Cobertura", priceArs: "100000.00" });
  B.agregar("product", { id: "prod-baja", workspaceId: "ws-1", name: "Vieja", priceArs: "1.00", isActive: false });
  B.agregar("product", { id: "prod-ajeno", workspaceId: "ws-2", name: "Ajeno", priceArs: "1.00" });
  plantillaId = B.agregar("fotofficeMessageTemplate", {
    workspaceId: "ws-1", channel: "EMAIL", entityType: "PRESUPUESTO", name: "Presupuesto", subject: "S", body: "B",
  }).id as string;
});

const guardar = (datos: Partial<import("./propuestas-modelo").DatosPropuestaModelo> = {}, ctx = DUENO) =>
  PM.guardarPropuestaModelo(ctx, { categoriaId: "cat-boda", items: [item("a")], condiciones: " Seña 30 %. ", enviarSola: true, plantillaId, ...datos });

describe("validarItemsDeModelo (puro)", () => {
  it("acepta productos del catálogo (LISTA) y conceptos calculados con trabajo", () => {
    expect(PM.validarItemsDeModelo([item("a")]).ok).toBe(true);
    expect(PM.validarItemsDeModelo([item("a", null)])).toEqual({ ok: false, error: M.soloLista });
    expect(PM.validarItemsDeModelo([concepto("c")]).ok).toBe(true);
  });

  it("rechaza un concepto calculado sin trabajo o ligado a un producto", () => {
    expect(PM.validarItemsDeModelo([concepto("c", { calculo: { entrada: { presupuesto: { concepts: [] } } } })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([concepto("c", { calculo: { entrada: {} } })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([concepto("c", { calculo: null })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([concepto("c", { productId: "prod-1" })])).toEqual({ ok: false, error: M.conceptoInvalido });
  });

  it("rechaza un concepto sin nombre o con un tipo de trabajo que no existe", () => {
    const con = (c: Record<string, unknown>) => concepto("c", { calculo: { entrada: { presupuesto: { concepts: [c] } } } });
    expect(PM.validarItemsDeModelo([con({ name: "", itemType: "own-service" })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([con({ name: "   ", itemType: "own-service" })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([con({ itemType: "own-service" })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([con({ name: "x" })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([con({ name: "x", itemType: "otro" })])).toEqual({ ok: false, error: M.conceptoInvalido });
    expect(PM.validarItemsDeModelo([con({ name: "x", itemType: "outsourced" })]).ok).toBe(true);
  });

  it("normaliza el concepto: precio 0 y sin perfil ni otros campos del cálculo", () => {
    const r = PM.validarItemsDeModelo([concepto("c", { precioUnitario: 5, calculo: { precioSugerido: 9, entrada: { perfil: { gastos: 1 }, presupuesto: { concepts: [{ name: "x", itemType: "expense" }] } } } })]);
    expect(r.ok && r.valor[0]).toMatchObject({ productId: null, precioUnitario: 0, modoPrecio: "CALCULO", calculo: { entrada: { presupuesto: { concepts: [{ name: "x" }] } } } });
    expect(r.ok && Object.keys(r.valor[0]!.calculo!)).toEqual(["entrada"]);
    expect(r.ok && Object.keys((r.valor[0]!.calculo as never as { entrada: object }).entrada)).toEqual(["presupuesto"]);
  });

  it("aplica los topes de la entrega A", () => {
    expect(PM.validarItemsDeModelo(Array.from({ length: 201 }, (_, i) => item(`i${i}`))).ok).toBe(false);
    expect(PM.validarItemsDeModelo([item("a", "prod-1", { cantidad: 0 })]).ok).toBe(false);
    expect(PM.validarItemsDeModelo([item("a"), item("a")]).ok).toBe(false);
    expect(PM.validarItemsDeModelo("nada").ok).toBe(false);
  });
});

describe("conceptos calculados: lista blanca", () => {
  it("no guarda un perfil (ni arriba ni dentro del concepto) ni campos ajenos", () => {
    const r = PM.validarItemsDeModelo([concepto("c", { calculo: { entrada: { presupuesto: {
      perfil: { gastos: 1 }, extra: 1, chosenPrice: "5000",
      client: { jobType: "Boda", perfil: { x: 1 }, hours: { salesHours: "2", otro: 1 } },
      concepts: [{ name: "Cobertura", itemType: "own-service", quantity: 2, coverageHours: "6", perfil: { gastos: 1 }, raro: "x" }, { name: "segundo" }],
    } } } })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.valor[0]!.calculo as never as { entrada: unknown }).entrada).toEqual({ presupuesto: {
      client: { jobType: "Boda", hours: { salesHours: "2" } }, chosenPrice: "5000",
      concepts: [{ name: "Cobertura", itemType: "own-service", quantity: "2", coverageHours: "6" }],
    } });
  });

  it("rechaza un primer concepto que no es un objeto", () => {
    expect(PM.validarItemsDeModelo([concepto("c", { calculo: { entrada: { presupuesto: { concepts: ["x"] } } } })])).toEqual({ ok: false, error: M.conceptoInvalido });
  });

  it("guardar y leer conserva el concepto calculado", async () => {
    expect(await guardar({ items: [item("a"), concepto("c")] as never, enviarSola: false })).toEqual({ ok: true });
    const p = await PM.leerPropuestaModelo("ws-1", "cat-boda");
    expect(p!.items).toHaveLength(2);
    expect(p!.items[1]).toMatchObject({ id: "c", productId: null, modoPrecio: "CALCULO", precioUnitario: 0 });
    expect(JSON.stringify(B.datos.fotofficePropuestaModelo[0])).not.toContain("perfil");
  });
});

describe("guardar, leer y borrar", () => {
  it("guarda la propuesta de la categoría y la lee", async () => {
    expect(await guardar()).toEqual({ ok: true });
    const p = await PM.leerPropuestaModelo("ws-1", "cat-boda");
    expect(p).toMatchObject({ categoriaId: "cat-boda", condiciones: "Seña 30 %.", enviarSola: true, plantillaId });
    expect(p!.items).toHaveLength(1);
    expect(B.datos.fotofficePropuestaModelo[0]).toMatchObject({ workspaceId: "ws-1", updatedByUserId: 1 });
  });

  it("guardar otra vez reemplaza (una por categoría)", async () => {
    await guardar();
    expect(await guardar({ items: [item("a"), item("b")], enviarSola: false })).toEqual({ ok: true });
    expect(B.datos.fotofficePropuestaModelo).toHaveLength(1);
    const p = await PM.leerPropuestaModelo("ws-1", "cat-boda");
    expect(p!.items).toHaveLength(2);
    expect(p!.enviarSola).toBe(false);
  });

  it("sin `configurar` no escribe", async () => {
    expect(await guardar({}, EQUIPO)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await PM.borrarPropuestaModelo(EQUIPO, "cat-boda")).toEqual({ ok: false, error: M.sinPermiso });
    expect(await PM.listarPropuestasModelo(EQUIPO)).toBeNull();
    expect(B.datos.fotofficePropuestaModelo).toHaveLength(0);
  });

  it("la categoría tiene que ser activa y del workspace", async () => {
    expect(await guardar({ categoriaId: "cat-ajena" })).toEqual({ ok: false, error: M.categoria });
    expect(await guardar({ categoriaId: "cat-vieja" })).toEqual({ ok: false, error: M.categoria });
    expect(await guardar({}, OTRO)).toEqual({ ok: false, error: M.categoria });
  });

  it("los productos tienen que ser activos y del workspace", async () => {
    expect(await guardar({ items: [item("a", "prod-ajeno")] })).toEqual({ ok: false, error: M.producto });
    expect(await guardar({ items: [item("a", "prod-baja")] })).toEqual({ ok: false, error: M.producto });
    expect(await guardar({ items: [item("a", "no-existe")] })).toEqual({ ok: false, error: M.producto });
  });

  it("la plantilla tiene que ser de correo, de PRESUPUESTO y del workspace", async () => {
    const wa = B.agregar("fotofficeMessageTemplate", { workspaceId: "ws-1", channel: "WHATSAPP", entityType: "PRESUPUESTO", name: "W", body: "B" }).id;
    const general = B.agregar("fotofficeMessageTemplate", { workspaceId: "ws-1", channel: "EMAIL", entityType: "GENERAL", name: "G", subject: "S", body: "B" }).id;
    const ajena = B.agregar("fotofficeMessageTemplate", { workspaceId: "ws-2", channel: "EMAIL", entityType: "PRESUPUESTO", name: "A", subject: "S", body: "B" }).id;
    const archivada = B.agregar("fotofficeMessageTemplate", {
      workspaceId: "ws-1", channel: "EMAIL", entityType: "PRESUPUESTO", name: "X", subject: "S", body: "B", archivedAt: new Date(),
    }).id;
    for (const id of [wa, general, ajena, archivada, "nada"]) {
      expect(await guardar({ plantillaId: id }), String(id)).toEqual({ ok: false, error: M.plantilla });
    }
  });

  it("para salir sola necesita ítems y plantilla; apagada, no", async () => {
    expect(await guardar({ items: [] })).toEqual({ ok: false, error: M.sinItems });
    expect(await guardar({ plantillaId: null })).toEqual({ ok: false, error: M.sinPlantilla });
    expect(await guardar({ items: [], plantillaId: null, enviarSola: false })).toEqual({ ok: true });
  });

  describe("salir sola con conceptos calculados", () => {
    const calculado = (datos: Record<string, unknown> = {}) =>
      concepto("c", { calculo: { entrada: { presupuesto: { client: { jobType: "Boda" }, concepts: [{ name: "Cobertura", itemType: "own-service", quantity: "1", coverageHours: "6", editingHours: "4", ...datos }] } } } });

    it("sin perfil de precios: no deja activarla", async () => {
      expect(await guardar({ items: [calculado()] as never })).toEqual({ ok: false, error: M.sinPerfil });
      expect(B.datos.fotofficePropuestaModelo).toHaveLength(0);
    });

    it("con un concepto que no da precio con el perfil: no deja activarla", async () => {
      B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", profileData: createBaseCompleteProfile() });
      expect(await guardar({ items: [concepto("c")] as never })).toEqual({ ok: false, error: M.calculoSinPrecio });
    });

    it("con perfil y un concepto que da precio: la guarda", async () => {
      B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", profileData: createBaseCompleteProfile() });
      expect(await guardar({ items: [item("a"), calculado()] as never })).toEqual({ ok: true });
    });

    it("apagada, un concepto calculado se guarda aunque no haya perfil", async () => {
      expect(await guardar({ items: [calculado()] as never, enviarSola: false })).toEqual({ ok: true });
    });
  });

  it("condiciones de más de 4000 caracteres no", async () => {
    expect(await guardar({ condiciones: "x".repeat(4001) })).toEqual({ ok: false, error: M.texto });
  });

  it("borrar sólo toca la del workspace", async () => {
    await guardar();
    expect(await PM.borrarPropuestaModelo(OTRO, "cat-boda")).toEqual({ ok: false, error: M.noExiste });
    expect(await PM.borrarPropuestaModelo(DUENO, "cat-boda")).toEqual({ ok: true });
    expect(await PM.leerPropuestaModelo("ws-1", "cat-boda")).toBeNull();
  });

  it("leer de otro workspace no la encuentra; ítems guardados inválidos se descartan", async () => {
    await guardar();
    expect(await PM.leerPropuestaModelo("ws-2", "cat-boda")).toBeNull();
    B.datos.fotofficePropuestaModelo[0]!.items = [{ roto: true }];
    expect((await PM.leerPropuestaModelo("ws-1", "cat-boda"))!.items).toEqual([]);
  });
});

describe("listado de categorías", () => {
  it("las activas del workspace, con su propuesta sí o no", async () => {
    await guardar();
    const l = await PM.listarPropuestasModelo(DUENO);
    expect(l).toEqual([
      { categoriaId: "cat-boda", nombre: "Boda", grupo: "Social", tienePropuesta: true, enviarSola: true, cantidadItems: 1 },
      { categoriaId: "cat-15", nombre: "15 años", grupo: "Social", tienePropuesta: false, enviarSola: false, cantidadItems: 0 },
    ]);
  });

  it("plantillas para elegir: sólo las de correo de PRESUPUESTO del workspace", async () => {
    B.agregar("fotofficeMessageTemplate", { workspaceId: "ws-1", channel: "WHATSAPP", entityType: "PRESUPUESTO", name: "W", body: "B" });
    const l = await PM.plantillasParaPropuesta("ws-1");
    expect(l).toEqual([{ id: plantillaId, nombre: "Presupuesto" }]);
  });
});
