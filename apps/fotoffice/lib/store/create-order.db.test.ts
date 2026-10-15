import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * La carrera de verdad: dos compradores, al mismo tiempo, por la ÚLTIMA unidad. Con el `tx` falso
 * de `create-order.test.ts` esto no se puede probar (no hay bloqueos sin Postgres), así que corre
 * contra una base real, y SÓLO si se le da una a propósito:
 *
 *   STORE_DB_TEST_URL=postgres://… npx vitest run lib/store/create-order.db.test.ts
 *
 * Tiene que ser una rama de prueba de Neon con el esquema aplicado: crea un workspace propio y
 * lo borra al terminar (en cascada se van el producto, la ficha y los pedidos). Nunca producción.
 */
const URL = process.env.STORE_DB_TEST_URL;

describe.skipIf(!URL)("createStoreOrder contra Postgres — concurrencia", () => {
  let prisma: typeof import("@repo/db").prisma;
  let createStoreOrder: typeof import("./create-order").createStoreOrder;
  let workspaceId = "";

  beforeAll(async () => {
    // El cliente de `@repo/db` lee DATABASE_URL al crearse: se apunta a la rama de prueba antes de importarlo.
    vi.stubEnv("DATABASE_URL", URL as string);
    vi.stubEnv("STORE_ORDER_TOKEN_SECRET", "clave-de-prueba-concurrencia");
    ({ prisma } = await import("@repo/db"));
    ({ createStoreOrder } = await import("./create-order"));

    const ws = await prisma.workspace.create({ data: { name: `Prueba tienda concurrencia ${Date.now()}` } });
    workspaceId = ws.id;
    const producto = await prisma.product.create({
      data: { workspaceId, name: "Última unidad", priceArs: "1000.00", tracksStock: true, stockQty: 1 },
    });
    await prisma.productStoreListing.create({
      data: { workspaceId, productId: producto.id, sellOnline: true, slug: "ultima-unidad" },
    });
  }, 60_000);

  afterAll(async () => {
    if (workspaceId) await prisma.workspace.delete({ where: { id: workspaceId } });
    vi.unstubAllEnvs();
  }, 60_000);

  it("dos pedidos simultáneos por la última unidad: exactamente uno sale bien", async () => {
    const producto = await prisma.product.findFirstOrThrow({ where: { workspaceId }, select: { id: true } });
    const pedir = (n: number) =>
      createStoreOrder({
        workspaceId,
        memberId: null,
        checkout: {
          buyerName: `Comprador ${n}`,
          buyerEmail: `comprador${n}@example.com`,
          buyerPhone: null,
          acceptsTerms: true,
          clientIdempotencyKey: `concurrencia-${Date.now()}-${n}`,
          lines: [{ productId: producto.id, variantId: null, qty: 1 }],
          delivery: { method: "PICKUP" },
          shownShippingMinor: null,
        },
      });

    const resultados = await Promise.all([pedir(1), pedir(2)]);

    expect(resultados.filter((r) => r.ok)).toHaveLength(1);
    const perdedor = resultados.find((r) => !r.ok);
    expect(perdedor && !perdedor.ok ? perdedor.problems?.length : 0).toBeGreaterThan(0);
    expect(await prisma.storeOrder.count({ where: { workspaceId } })).toBe(1);
  }, 60_000);
});
