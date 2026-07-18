import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSimulateErrorResponse } from "./error-response.js";

describe("buildSimulateErrorResponse", () => {
  it("omite details cuando no se informan", () => {
    assert.deepEqual(buildSimulateErrorResponse("empty_body"), {
      ok: false,
      error: "empty_body",
      service: "dnx-sales-assistant",
    });
  });

  it("incluye details de validación", () => {
    const body = buildSimulateErrorResponse("validation_error", [
      { path: "from", message: "inválido" },
    ]);
    assert.equal(body.ok, false);
    assert.equal(body.error, "validation_error");
    assert.deepEqual(body.details, [{ path: "from", message: "inválido" }]);
  });
});
