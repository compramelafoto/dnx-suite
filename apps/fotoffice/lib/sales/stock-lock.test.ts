import { describe, expect, it, vi } from "vitest";
import { lockStockRows } from "./stock-lock";

type Sql = { sql: string; text: string; values: unknown[] };

function lockTx() {
  return { $queryRaw: vi.fn<(q: Sql) => Promise<unknown[]>>(async () => []) };
}

describe("lockStockRows", () => {
  it("bloquea primero los productos y después los talles, FOR UPDATE, filtrando por workspace", async () => {
    const tx = lockTx();
    await lockStockRows(tx as never, { workspaceId: "ws1", productIds: ["p2", "p1"], variantIds: ["v9", "v3"] });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    const [productos, talles] = tx.$queryRaw.mock.calls.map((c) => c[0]);
    expect(productos.sql).toMatch(/FROM "Product"/);
    expect(talles.sql).toMatch(/FROM "ProductVariant"/);
    for (const q of [productos, talles]) {
      // `text` es la forma con `$n` que recibe Postgres: los ids viajan como parámetro, no pegados.
      expect(q.text).toMatch(/= ANY\(\$1::text\[\]\)/);
      expect(q.text).toMatch(/"workspaceId" = \$2/);
      expect(q.sql).toMatch(/ORDER BY "id"/);
      expect(q.sql).toMatch(/FOR UPDATE/);
    }
    // Ordenados: dos compras que se cruzan piden los bloqueos en el mismo orden (sin interbloqueo).
    expect(productos.values).toEqual([["p1", "p2"], "ws1"]);
    expect(talles.values).toEqual([["v3", "v9"], "ws1"]);
  });

  it("sin repetidos, y sin consulta de talles si no hay talles", async () => {
    const tx = lockTx();
    await lockStockRows(tx as never, { workspaceId: "ws1", productIds: ["p1", "p1"], variantIds: [] });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual([["p1"], "ws1"]);
  });

  it("sin nada que bloquear no consulta", async () => {
    const tx = lockTx();
    await lockStockRows(tx as never, { workspaceId: "ws1", productIds: [], variantIds: [] });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
