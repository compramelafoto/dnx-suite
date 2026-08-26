import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRevisionConflictResponse,
  TEMPLATE_V2_REVISION_CONFLICT_MESSAGE,
} from "../revision-conflict";

describe("revision-conflict helpers", () => {
  it("detecta 409 revision_conflict", () => {
    assert.equal(isRevisionConflictResponse(409, "revision_conflict"), true);
  });

  it("ignora otros 409", () => {
    assert.equal(isRevisionConflictResponse(409, "other"), false);
    assert.equal(isRevisionConflictResponse(400, "revision_conflict"), false);
  });

  it("mensaje UI es el acordado en P0-04", () => {
    assert.match(TEMPLATE_V2_REVISION_CONFLICT_MESSAGE, /otra pestaña|otra persona/i);
    assert.match(TEMPLATE_V2_REVISION_CONFLICT_MESSAGE, /Recargá/i);
  });
});
