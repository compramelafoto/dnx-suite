import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ctxDePrueba } from "@/lib/informes/ctx-prueba";

const M = vi.hoisted(() => ({
  ctx: null as unknown,
  resultados: vi.fn(),
  detalleRes: vi.fn(),
  detalleFlujo: vi.fn(),
  flujo: vi.fn(),
  monotributo: vi.fn(),
  ventas: vi.fn(),
  detalleVentas: vi.fn(),
  embudo: vi.fn(),
  workspace: vi.fn(async () => ({ name: "Mi Estudio" })),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: { workspace: { findUnique: M.workspace } } }));
vi.mock("@/lib/informes/acceso", () => ({ contextoDeInformes: vi.fn(async () => M.ctx) }));
vi.mock("@/lib/informes/resultados-datos", () => ({ cargarResultados: M.resultados }));
vi.mock("@/lib/informes/detalle-datos", () => ({ cargarDetalleResultados: M.detalleRes, cargarDetalleFlujo: M.detalleFlujo }));
vi.mock("@/lib/informes/flujo-datos", () => ({ cargarFlujo: M.flujo }));
vi.mock("@/lib/informes/ventas-datos", () => ({ cargarVentas: M.ventas, cargarDetalleVentas: M.detalleVentas }));
vi.mock("@/lib/informes/embudo-datos", () => ({ cargarEmbudo: M.embudo }));
vi.mock("@/lib/informes/monotributo-datos", () => ({ cargarMonotributo: M.monotributo }));

const { GET } = await import("./route");
const { armarResultados } = await import("@/lib/informes/resultados");
const { armarFlujo } = await import("@/lib/informes/flujo");
const { armarMonotributo } = await import("@/lib/informes/monotributo");
const { armarVentas } = await import("@/lib/informes/ventas");
const { armarEmbudo } = await import("@/lib/informes/embudo");

const llamar = (informe: string, query = "") =>
  GET(new NextRequest(`http://localhost/api/informes/${informe}/csv${query}`), { params: Promise.resolve({ informe }) });

const matriz = armarResultados({
  meses: ["2026-10"],
  rubros: [{ id: "r1", nombre: "Ventas", codigo: "3.1", parentId: null, activo: true }],
  asientos: [{ mes: "2026-10", categoryId: "r1", kind: "INGRESO", centavos: 123450, signo: 1 }],
});

beforeEach(() => {
  vi.clearAllMocks();
  M.ctx = ctxDePrueba();
});

describe("GET /api/informes/[informe]/csv", () => {
  it("sin permiso responde 404 y no lee nada", async () => {
    M.ctx = null;
    const r = await llamar("resultados");
    expect(r.status).toBe(404);
    expect(M.resultados).not.toHaveBeenCalled();
  });

  it("un informe que no existe responde 404", async () => {
    expect((await llamar("inexistente")).status).toBe(404);
    expect(M.resultados).not.toHaveBeenCalled();
  });

  it("Resultados: CSV con BOM, punto y coma, importes en pesos y nombre de archivo", async () => {
    M.resultados.mockResolvedValue({ periodo: { valor: "este-mes" }, base: "caja", matriz, cantidadAsientos: 1, avisos: [] });
    const r = await llamar("resultados", "?base=caja&periodo=este-mes");
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toContain("text/csv");
    expect(r.headers.get("Content-Disposition")).toMatch(/^attachment; filename="mi-estudio-informe-resultados-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    const bytes = new Uint8Array(await r.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const t = new TextDecoder().decode(bytes);
    expect(t).toContain("Bloque;Rubro;10/2026;Total");
    expect(t).toContain("Ingresos;3.1 Ventas;1234,50;1234,50");
    expect(t).toContain("Resultado;Resultado;1234,50;1234,50");
    expect(M.resultados.mock.calls[0][1]).toEqual({ periodo: "este-mes", base: "caja" });
  });

  it("Resultados con rango desde/hasta lo pasa como período", async () => {
    M.resultados.mockResolvedValue({ periodo: { valor: "x" }, base: "caja", matriz, cantidadAsientos: 1, avisos: [] });
    await llamar("resultados", "?desde=2026-01&hasta=2026-03");
    expect(M.resultados.mock.calls[0][1]).toMatchObject({ periodo: "2026-01..2026-03" });
  });

  it("si se pasó el tope de datos responde 422 con el aviso, no un archivo parcial", async () => {
    M.resultados.mockResolvedValue({ periodo: { valor: "este-mes" }, base: "caja", matriz: null, cantidadAsientos: 0, avisos: ["Hay demasiados datos para este período, achicá el rango"] });
    const r = await llamar("resultados");
    expect(r.status).toBe(422);
    expect(await r.text()).toContain("demasiados datos");
  });

  it("Detalle: trae todas las filas y el total", async () => {
    M.detalleRes.mockResolvedValue({
      avisos: [], total: 1500, filas: [], cantidad: 2,
      todas: [
        { clave: "a", fecha: "2026-10-05", origen: "Pedido P-1", contacto: "Ana; \"la\" Paz", descripcion: "=1+1", centavos: 1000, href: null },
        { clave: "b", fecha: "2026-10-06", origen: "Cuenta a pagar", contacto: null, descripcion: "Luz", centavos: 500, href: null },
      ],
    });
    const r = await llamar("resultados-detalle", "?bloque=INGRESOS");
    const t = await r.text();
    expect(t).toContain("Fecha;Origen;Contacto;Descripción;Importe");
    expect(t).toContain("05/10/2026;Pedido P-1;\"Ana; \"\"la\"\" Paz\";'=1+1;10,00");
    expect(t).toContain(";Total;;;15,00");
  });

  it("Flujo y Monotributo arman su CSV", async () => {
    const flujo = armarFlujo({ hoy: "2026-10-09", agrupar: "mes", hasta: "2026-11-30", saldoCaja: 100000, cuotas: [{ dueDate: "2026-10-20", saldoCentavos: 50000 }], cuentas: [{ dueDate: null, centavos: 2500 }], saldoMinimo: null });
    M.flujo.mockResolvedValue({ flujo, avisos: [] });
    const f = await (await llamar("flujo", "?agrupar=mes&horizonte=3m")).text();
    expect(f).toContain("Período;Desde;Hasta;Por cobrar;Por pagar;Neto;Saldo acumulado");
    expect(f).toContain("Hoy;");
    expect(f).toContain("Sin fecha;;;;25,00");

    M.monotributo.mockResolvedValue({ resultado: armarMonotributo({ hoy: "2026-10-09", ingresosPorMes: { "2026-10": 100000 }, tope: 200000, avisoPct: 80 }), tope: 200000, categoria: "C", avisos: [] });
    const m = await (await llamar("monotributo")).text();
    expect(m).toContain("Concepto;Importe;Porcentaje del tope");
    expect(m).toContain("Total cobrado en 12 meses;1000,00;50 %");
    expect(m).toContain("Tope anual (categoría C);2000,00");
    expect(m).toContain("Control interno con lo registrado en Caja");
  });

  it("el cargador que no devuelve nada (sin permiso interno) también da 404", async () => {
    M.flujo.mockResolvedValue(null);
    expect((await llamar("flujo")).status).toBe(404);
  });

  it("Ventas: CSV de la matriz con el agrupamiento pedido y 422 si se pasó el tope", async () => {
    const matrizVentas = armarVentas({
      meses: ["2026-10"], agrupar: "cliente",
      pedidos: [{ id: "1", numero: "P-1", confirmadoEn: new Date("2026-10-05T15:00:00Z"), fechaEvento: null, totalCentavos: 123450, items: [], clienteId: "c1", cliente: "Ana", vendedorId: null, vendedor: "", tieneConsulta: false, categoriaId: null, categoria: null, origenId: null, origen: null }],
    });
    M.ventas.mockResolvedValue({ periodo: { valor: "este-mes" }, agrupar: "cliente", matriz: matrizVentas, cantidadPedidos: 1, avisos: [] });
    const r = await llamar("ventas", "?agrupar=cliente&periodo=este-mes");
    expect(r.status).toBe(200);
    const t = await r.text();
    expect(t).toContain("Cliente;10/2026;Total;Pedidos");
    expect(t).toContain("Ana;1234,50;1234,50;1");
    expect(M.ventas.mock.calls[0][1]).toEqual({ periodo: "este-mes", agrupar: "cliente" });

    M.ventas.mockResolvedValue({ periodo: { valor: "este-mes" }, agrupar: "cliente", matriz: null, cantidadPedidos: 0, avisos: ["Hay demasiados datos para este período, achicá el rango"] });
    const tope = await llamar("ventas");
    expect(tope.status).toBe(422);
    expect(await tope.text()).toContain("demasiados datos");
  });

  it("Ventas detalle: todas las filas con el total; sin permiso interno, 404", async () => {
    M.detalleVentas.mockResolvedValue({
      avisos: [], total: 500, cantidad: 1, filas: [],
      todas: [{ clave: "1", pedidoId: "1", numero: "P-1", confirmado: "2026-10-05", cliente: "Ana", fechaEvento: "2026-12-12", categoria: "Bodas", vendedor: "Vera", centavos: 500 }],
    });
    const t = await (await llamar("ventas-detalle", "?grupo=c:c1")).text();
    expect(t).toContain("Pedido;Fecha de confirmación;Cliente;Fecha del evento;Categoría;Vendedor;Importe");
    expect(t).toContain("P-1;05/10/2026;Ana;12/12/2026;Bodas;Vera;5,00");
    expect(t).toContain("Total;;;;;;5,00");
    M.detalleVentas.mockResolvedValue(null);
    expect((await llamar("ventas-detalle")).status).toBe(404);
  });

  it("Embudo: CSV con una fila por grupo y el total; 422 si se pasó el tope", async () => {
    const tabla = armarEmbudo({
      agrupar: "categoria",
      consultas: [
        { id: "1", creadaEn: new Date("2026-10-01T15:00:00Z"), categoriaId: "k1", categoria: "Bodas", origenId: null, origen: null, valorEstimadoCentavos: 100000, resultado: "GANADA", cerradaEn: new Date("2026-10-04T15:00:00Z"), vendidoCentavos: 123450 },
        { id: "2", creadaEn: new Date("2026-10-01T15:00:00Z"), categoriaId: "k1", categoria: "Bodas", origenId: null, origen: null, valorEstimadoCentavos: 0, resultado: null, cerradaEn: null, vendidoCentavos: 0 },
      ],
    });
    M.embudo.mockResolvedValue({ periodo: { valor: "este-mes" }, agrupar: "categoria", tabla, avisos: [] });
    const r = await llamar("embudo", "?agrupar=categoria&periodo=este-mes");
    expect(r.status).toBe(200);
    const t = await r.text();
    expect(t).toContain("Categoría;Entraron;Ganadas;Perdidas;Abiertas;% de conversión;Valor estimado;Vendido;Días promedio hasta cerrar");
    expect(t).toContain("Bodas;2;1;0;1;50 %;1000,00;1234,50;3");
    expect(t).toContain("Total;2;1;0;1;50 %;1000,00;1234,50;3");
    expect(M.embudo.mock.calls[0][1]).toEqual({ periodo: "este-mes", agrupar: "categoria" });

    M.embudo.mockResolvedValue({ periodo: { valor: "este-mes" }, agrupar: "categoria", tabla: null, avisos: ["Hay demasiados datos para este período, achicá el rango"] });
    expect((await llamar("embudo")).status).toBe(422);
    M.embudo.mockResolvedValue(null);
    expect((await llamar("embudo")).status).toBe(404);
  });
});
