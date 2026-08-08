import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("ops reconcile endpoint", () => {
  it("endpoint temporal /api/ops/reconcile-payment está eliminado", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const route = path.resolve(
      here,
      "../../../app/api/ops/reconcile-payment/route.ts",
    );
    assert.equal(existsSync(route), false, `expected absent: ${route}`);
  });
});
