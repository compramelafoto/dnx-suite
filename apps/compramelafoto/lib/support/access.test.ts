/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/support/access.test.ts
 */

import assert from "node:assert/strict";
import {
  SUPPORT_TICKET_FORBIDDEN_FIELDS,
  isTicketClosedForUserReply,
  normalizeRequesterRole,
  sanitizeCreateTicketBody,
  sanitizeMessageBody,
  sanitizeSupportText,
  toPublicSupportTicket,
} from "./sanitize";

{
  assert.equal(isTicketClosedForUserReply("OPEN"), false);
  assert.equal(isTicketClosedForUserReply("IN_PROGRESS"), false);
  assert.equal(isTicketClosedForUserReply("CLOSED"), true);
  assert.equal(isTicketClosedForUserReply("RESOLVED"), true);
}

{
  assert.equal(normalizeRequesterRole("CLIENT", null), "CUSTOMER");
  assert.equal(normalizeRequesterRole("PHOTOGRAPHER", null), "PHOTOGRAPHER");
  assert.equal(normalizeRequesterRole("HACKER", "ORGANIZER"), "OTHER");
  assert.equal(normalizeRequesterRole(null, "ORGANIZER"), "ORGANIZER");
}

{
  const cleaned = sanitizeSupportText(
    "<script>alert(1)</script>Hola\u0000 mundo",
    100
  );
  assert.equal(cleaned.includes("<script>"), false);
  assert.ok(cleaned.includes("Hola"));
}

{
  const bad = sanitizeCreateTicketBody({}, {});
  assert.equal(bad.ok, false);

  const ok = sanitizeCreateTicketBody(
    {
      reason: "TECHNICAL_ISSUE",
      description: "No puedo subir fotos al álbum",
      requesterRole: "PHOTOGRAPHER",
    },
    { email: "a@b.com", name: "Ana", role: "PHOTOGRAPHER" }
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.reason, "TECHNICAL_ISSUE");
    assert.equal(ok.data.requesterRole, "PHOTOGRAPHER");
  }
}

{
  assert.equal(sanitizeMessageBody({ message: "" }).ok, false);
  assert.equal(sanitizeMessageBody({ message: "  ok  " }).ok, true);
  const xss = sanitizeMessageBody({
    message: "<b>hola</b> <script>x</script>",
  });
  assert.equal(xss.ok, true);
  if (xss.ok) {
    assert.equal(xss.message.includes("<"), false);
    assert.ok(xss.message.includes("hola"));
  }
}

{
  const pub = toPublicSupportTicket({
    id: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    reason: "OTHER",
    description: "desc",
    status: "OPEN",
    printOrderId: null,
    requesterName: "Ana",
    requesterEmail: "ana@example.com",
    requesterRole: "PHOTOGRAPHER",
    printOrder: { id: 9, customerName: "Cliente", customerEmail: "secret@x.com" },
    messages: [],
  });
  for (const key of SUPPORT_TICKET_FORBIDDEN_FIELDS) {
    assert.ok(!(key in pub));
  }
  assert.ok(!("customerEmail" in (pub.printOrder || {})));
  assert.equal(pub.printOrder?.id, 9);
}

console.log("support access/sanitize tests OK");
