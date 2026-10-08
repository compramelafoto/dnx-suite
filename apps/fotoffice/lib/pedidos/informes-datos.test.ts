import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Informes de Pedidos: lectura con permisos. Sin `configurar` ni `verDinero` no se consulta la base
 * y la página recibe `null` en cada informe; con permiso, los números salen de las mismas cuentas
 * que la ficha (cuotas menos imputaciones sin anular), sin pedidos cancelados ni cobros anulados.
 */

const M = vi.hoisted(() => {
  const d = (v: number) => ({ toString: () => v.toFixed(2) });
  const nombre = (businessName: string) => ({ firstName: null, lastName: null, businessName });
  const llamadas: string[] = [];
  const prisma = {
    fotofficePedido: {
      findMany: vi.fn(async () => {
        llamadas.push("pedido");
        return [
          { id: "p1", number: "P-1", clientId: "c1", status: "EN_CURSO", totalArs: d(1000), client: nombre("Ana SA") },
          { id: "p2", number: "P-2", clientId: "c2", status: "CONFIRMADO", totalArs: d(500), client: nombre("Beto SRL") },
        ];
      }),
    },
    fotofficePedidoCuota: {
      findMany: vi.fn(async () => [
        { id: "q1", pedidoId: "p1", position: 1, dueDate: new Date("2026-09-01T00:00:00Z"), amountArs: d(600), suggestedMethod: null },
        { id: "q2", pedidoId: "p1", position: 2, dueDate: new Date("2026-10-09T00:00:00Z"), amountArs: d(400), suggestedMethod: null },
        { id: "q3", pedidoId: "p2", position: 1, dueDate: new Date("2026-12-01T00:00:00Z"), amountArs: d(500), suggestedMethod: null },
      ]),
    },
    fotofficeCobroImputacion: {
      findMany: vi.fn(async () => [
        { cobroId: "k1", cuotaId: "q1", amountArs: d(100) },
        { cobroId: "k2", cuotaId: "q1", amountArs: d(300) }, // anulado: no cuenta
      ]),
    },
    fotofficeCobro: {
      findMany: vi.fn(async (a: { select: Record<string, boolean>; where?: Record<string, unknown> }) => {
        llamadas.push("cobro");
        if (a.select.voidedAt) return [{ id: "k1", voidedAt: null }, { id: "k2", voidedAt: new Date() }];
        return [{ paidAt: new Date("2026-10-05T15:00:00Z"), method: "EFECTIVO", amountArs: d(100) }];
      }),
    },
    fotofficeCuentaPagar: {
      findMany: vi.fn(async () => {
        llamadas.push("cuenta");
        return [
          { id: "a1", supplierClientId: "s1", dueDate: new Date("2026-10-01T00:00:00Z"), amountArs: d(70), supplier: { firstName: null, lastName: null, businessName: "Imprenta" } },
          { id: "a2", supplierClientId: null, dueDate: null, amountArs: d(30), supplier: null },
        ];
      }),
    },
  };
  return { prisma, llamadas };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: M.prisma, Prisma: {} }));

const { cargarInformes } = await import("./informes-datos");

const AHORA = new Date("2026-10-08T15:00:00Z"); // jueves 08/10 en Argentina
const conRol = (role: string, levels: Record<string, string> = { orders: "VIEW" }) =>
  ({ workspaceId: "ws-1", userId: 1, userLabel: "X", role, acceso: { role, levels } as never }) as never;

beforeEach(() => {
  M.llamadas.length = 0;
});

describe("cargarInformes", () => {
  it("sin configurar ni verDinero: no lee nada y no devuelve montos", async () => {
    const r = await cargarInformes(conRol("STAFF"), undefined, AHORA);
    expect(r.aCobrar).toBeNull();
    expect(r.cobrado).toBeNull();
    expect(r.aPagar).toBeNull();
    expect(M.llamadas).toEqual([]);
  });

  it("con Caja en Ver (verDinero) sí ve los montos", async () => {
    const r = await cargarInformes(conRol("STAFF", { orders: "VIEW", cash: "VIEW" }), undefined, AHORA);
    expect(r.aCobrar).not.toBeNull();
  });

  it("dueño: saldos de la ficha (sin imputaciones anuladas), cobrado del mes y a pagar", async () => {
    const r = await cargarInformes(conRol("WORKSPACE_OWNER"), "2026-10", AHORA);
    expect(r.hoy).toBe("2026-10-08");
    // q1: 600 - 100 = 500 vencida; q2: 400 vence el 09/10 (esta semana); q3: 500 en diciembre.
    expect(r.aCobrar).toMatchObject({ vencido: 500, estaSemana: 400, total: 1400 });
    expect(r.aCobrar!.antiguedad["31-60"]).toBe(500);
    expect(r.cobrado).toMatchObject({ mes: "2026-10", total: 100, cantidad: 1 });
    expect(r.aPagar).toMatchObject({ vencido: 70, proximos: 0, total: 70 });
    expect(r.aPagar!.sinVencimiento).toMatchObject({ total: 30, cuentas: 1 });
  });

  it("consulta sólo cobros vigentes y cuentas sin pago, y pedidos sin cancelar", async () => {
    await cargarInformes(conRol("WORKSPACE_OWNER"), undefined, AHORA);
    const donde = (m: { mock: { calls: unknown[][] } }, i = 0) => (m.mock.calls[i][0] as { where: Record<string, unknown> }).where;
    expect(donde(M.prisma.fotofficePedido.findMany).status).toEqual({ in: ["CONFIRMADO", "EN_CURSO", "COMPLETADO"] });
    const cobros = M.prisma.fotofficeCobro.findMany.mock.calls.map((c) => (c[0] as { where: Record<string, unknown> }).where);
    expect(cobros.some((w) => w.voidedAt === null && w.paidAt)).toBe(true);
    expect(donde(M.prisma.fotofficeCuentaPagar.findMany).paidAt).toBeNull();
  });
});

describe("reglas de fuente", () => {
  const leer = (ruta: string) => readFileSync(join(__dirname, "..", "..", ruta), "utf8");
  it("la página es de servidor, sin componentes de navegador, y el cargador exige el permiso", () => {
    const pagina = leer("app/(shell)/pedidos/informes/page.tsx");
    expect(pagina).not.toContain('"use client"');
    expect(pagina).not.toMatch(/from "@\/components\/(?!page-header)/);
    expect(pagina).toContain("requirePedidos(\"ver\")");
    expect(pagina).toContain("Sin permiso para ver montos");
    const datos = leer("lib/pedidos/informes-datos.ts");
    expect(datos).toMatch(/if \(!puedeVerMontosDeInformes\(ctx\)\) return/);
    expect(datos.indexOf("puedeVerMontosDeInformes(ctx)")).toBeLessThan(datos.indexOf("prisma.fotofficePedido"));
  });
  it("Pedidos enlaza a Informes sólo con veCostosDePedido", () => {
    const lista = leer("app/(shell)/pedidos/page.tsx");
    expect(lista).toMatch(/veCostosDePedido\(ctx\) \? \(\s*<Link href="\/pedidos\/informes"/);
  });
});
