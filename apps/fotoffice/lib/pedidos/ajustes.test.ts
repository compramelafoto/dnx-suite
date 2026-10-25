import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const AJ = await import("./ajustes");
const PE = await import("./pedidos");

const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER" };
const MIEMBRO = { workspaceId: "ws-1", userId: 2, userLabel: "Ana", role: "WORKSPACE_MEMBER" };
const VALIDO = { recordatorioDias: "3", recordatorioActivo: true, rubroIngresoId: "" };

beforeEach(() => {
  B.vaciar();
  B.agregar("cashCategory", { id: "ing", workspaceId: "ws-1", name: "Eventos", kind: "INGRESO" });
  B.agregar("cashCategory", { id: "egr", workspaceId: "ws-1", name: "Gastos", kind: "EGRESO" });
  B.agregar("cashCategory", { id: "ajeno", workspaceId: "ws-2", name: "Otro", kind: "INGRESO" });
  B.agregar("cashCategory", { id: "viejo", workspaceId: "ws-1", name: "Viejo", kind: "INGRESO", isActive: false });
});

describe("ajustes de Pedidos", () => {
  it("sin fila valen los de fábrica: un día antes, apagado, sin rubro", async () => {
    expect(await AJ.leerAjustesPedidos("ws-1")).toEqual({ recordatorioDias: 1, recordatorioActivo: false, rubroIngresoId: null });
  });

  it("guarda con `configurar` y lo vuelve a leer; sin `configurar` no escribe", async () => {
    expect(await AJ.guardarAjustesPedidos(MIEMBRO, VALIDO)).toEqual({ ok: false, error: AJ.MENSAJES_AJUSTES_PEDIDOS.sinPermiso });
    expect(B.datos.fotofficePedidoAjustes).toHaveLength(0);
    expect(await AJ.guardarAjustesPedidos(DUENO, { ...VALIDO, rubroIngresoId: "ing" })).toEqual({ ok: true });
    expect(await AJ.leerAjustesPedidos("ws-1")).toEqual({ recordatorioDias: 3, recordatorioActivo: true, rubroIngresoId: "ing" });
    // Segunda vez actualiza la misma fila.
    expect(await AJ.guardarAjustesPedidos(DUENO, { recordatorioDias: 0, recordatorioActivo: false, rubroIngresoId: "" })).toEqual({ ok: true });
    expect(B.datos.fotofficePedidoAjustes).toHaveLength(1);
    expect(await AJ.leerAjustesPedidos("ws-1")).toEqual({ recordatorioDias: 0, recordatorioActivo: false, rubroIngresoId: null });
  });

  it("los días van de 0 a 30, enteros", async () => {
    for (const malo of ["-1", "31", "1.5", "abc", ""]) {
      expect(await AJ.guardarAjustesPedidos(DUENO, { ...VALIDO, recordatorioDias: malo }), malo).toEqual({ ok: false, error: AJ.MENSAJES_AJUSTES_PEDIDOS.dias });
    }
    expect((await AJ.guardarAjustesPedidos(DUENO, { ...VALIDO, recordatorioDias: "30" })).ok).toBe(true);
  });

  it("el rubro tiene que ser un INGRESO del mismo workspace", async () => {
    for (const malo of ["egr", "ajeno", "no-existe", 42]) {
      expect(await AJ.guardarAjustesPedidos(DUENO, { ...VALIDO, rubroIngresoId: malo }), String(malo)).toEqual({ ok: false, error: AJ.MENSAJES_AJUSTES_PEDIDOS.rubro });
    }
  });

  it("ofrece sólo los rubros INGRESO activos del workspace", async () => {
    expect(await AJ.rubrosDeIngreso("ws-1")).toEqual([{ id: "ing", nombre: "Eventos" }]);
  });

  it("DNX nace con el recordatorio un día antes, encendido; nunca pisa una fila ni siembra a otros", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnxestudio" });
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otro-estudio" });
    expect(await AJ.asegurarAjustesPedidosDnx("ws-2")).toBe(false);
    expect(await AJ.asegurarAjustesPedidosDnx("ws-1")).toBe(true);
    expect(await AJ.leerAjustesPedidos("ws-1")).toEqual({ recordatorioDias: 1, recordatorioActivo: true, rubroIngresoId: null });
    await AJ.guardarAjustesPedidos(DUENO, { recordatorioDias: "5", recordatorioActivo: false, rubroIngresoId: "" });
    expect(await AJ.asegurarAjustesPedidosDnx("ws-1")).toBe(false);
    expect(await AJ.leerAjustesPedidos("ws-1")).toMatchObject({ recordatorioDias: 5, recordatorioActivo: false });
    expect(B.datos.fotofficePedidoAjustes).toHaveLength(1);
  });
});

describe("semilla de las plantillas de checklist de DNX", () => {
  const NOMBRES = ["Pedidos con Contrato", "Pedidos Simple"];
  const guardadas = () => (B.datos.fotofficePedidoAjustes[0]?.checklistTemplates as { name: string; tasks: string[] }[] | null | undefined) ?? null;

  it("DNX nace con las dos plantillas, sin el duplicado de la firma del contrato", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnxestudio" });
    await AJ.asegurarAjustesPedidosDnx("ws-1");
    const g = guardadas()!;
    expect(g.map((p) => p.name)).toEqual(NOMBRES);
    expect(g[0]!.tasks).toEqual(["Enviar contrato", "Recoger firma del contrato", "Cobrar seña", "Confirmar horarios y lugar", "Asignar equipo", "Evento realizado", "Entregar material"]);
    expect(g[1]!.tasks).toEqual(["Cobrar seña", "Confirmar horarios y lugar", "Asignar equipo", "Evento realizado", "Entregar material"]);
  });

  it("con la fila ya creada y sin plantillas (null), las completa; no toca lo demás", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnxestudio" });
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", reminderDays: 5, reminderEnabled: false, checklistTemplates: null });
    expect(await AJ.asegurarAjustesPedidosDnx("ws-1")).toBe(true);
    expect(guardadas()!.map((p) => p.name)).toEqual(NOMBRES);
    expect(B.datos.fotofficePedidoAjustes[0]).toMatchObject({ reminderDays: 5, reminderEnabled: false });
  });

  it("nunca pisa plantillas propias, ni una lista vacía", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnxestudio" });
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: [{ name: "Mía", tasks: ["Una"] }] });
    expect(await AJ.asegurarAjustesPedidosDnx("ws-1")).toBe(false);
    expect(guardadas()).toEqual([{ name: "Mía", tasks: ["Una"] }]);
    B.datos.fotofficePedidoAjustes[0]!.checklistTemplates = [];
    expect(await AJ.asegurarAjustesPedidosDnx("ws-1")).toBe(false);
    expect(guardadas()).toEqual([]);
  });

  it("otra organización no recibe plantillas", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otro-estudio" });
    expect(await AJ.asegurarAjustesPedidosDnx("ws-2")).toBe(false);
    expect(B.datos.fotofficePedidoAjustes).toHaveLength(0);
  });
});

describe("rubro de ingreso por omisión al confirmar", () => {
  const items = [{ productId: "prod-1" }, { productId: null }] as never[];

  it("sin rubro en los productos usa el de Configuración → Pedidos", async () => {
    expect(await PE.rubroDeItems(B.prisma as never, "ws-1", items)).toBeNull();
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", incomeCategoryId: "ing" });
    expect(await PE.rubroDeItems(B.prisma as never, "ws-1", items)).toBe("ing");
  });

  it("el rubro de un producto gana al de omisión", async () => {
    B.agregar("cashCategory", { id: "ing-prod", workspaceId: "ws-1", name: "Producto", kind: "INGRESO" });
    B.agregar("fotofficeProductoCatalogo", { id: "pc-1", workspaceId: "ws-1", productId: "prod-1", incomeCategoryId: "ing-prod" });
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", incomeCategoryId: "ing" });
    expect(await PE.rubroDeItems(B.prisma as never, "ws-1", items)).toBe("ing-prod");
  });

  it("un rubro de omisión que dejó de ser INGRESO no se usa", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", incomeCategoryId: "egr" });
    expect(await PE.rubroDeItems(B.prisma as never, "ws-1", items)).toBeNull();
  });
});
