import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryAuditSink } from "../application/repos/memory.js";
import { SANDBOX_TEST_TOKEN } from "../providers/mercado-pago/testing/fixtures.js";

describe("InMemoryAuditSink sanitization", () => {
  it("redacts token fields from audit data", async () => {
    const audit = new InMemoryAuditSink();
    await audit.record({
      actorType: "system",
      action: "test.action",
      aggregateType: "test",
      aggregateId: "1",
      data: {
        accessToken: SANDBOX_TEST_TOKEN,
        authorization: "Bearer secret",
        safeField: "visible",
      },
    });

    const events = await audit.list();
    assert.equal(events.length, 1);
    const data = events[0]?.data;
    assert.equal(data?.accessToken, "[REDACTED]");
    assert.equal(data?.authorization, "[REDACTED]");
    assert.equal(data?.safeField, "visible");
    assert.ok(!JSON.stringify(data).includes("TEST-fake"));
  });
});
