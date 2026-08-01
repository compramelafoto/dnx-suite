/**
 * Offline selfcheck: welcome card share filenames + ownership rules (no HTTP).
 */
import assert from "node:assert/strict";

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function ownership(input: {
  registrationUserId: number | null;
  registrationEmail: string;
  sessionUserId: number;
  sessionEmail: string;
}): boolean {
  return (
    input.registrationUserId === input.sessionUserId ||
    input.registrationEmail.toLowerCase() === input.sessionEmail.toLowerCase()
  );
}

function main() {
  assert.equal(sanitizeFilenamePart("CKA26-0001"), "CKA26-0001");
  assert.equal(
    `clickaton-bienvenida-${sanitizeFilenamePart("CKA26/0001!")}.png`,
    "clickaton-bienvenida-CKA26-0001.png",
  );

  assert.equal(
    ownership({
      registrationUserId: 1,
      registrationEmail: "a@b.com",
      sessionUserId: 1,
      sessionEmail: "other@b.com",
    }),
    true,
  );
  assert.equal(
    ownership({
      registrationUserId: null,
      registrationEmail: "User@B.com",
      sessionUserId: 9,
      sessionEmail: "user@b.com",
    }),
    true,
  );
  assert.equal(
    ownership({
      registrationUserId: 2,
      registrationEmail: "a@b.com",
      sessionUserId: 1,
      sessionEmail: "x@y.com",
    }),
    false,
  );

  console.log(JSON.stringify({ ok: true, checks: 5 }));
}

main();
