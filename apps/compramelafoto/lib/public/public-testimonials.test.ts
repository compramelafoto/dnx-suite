/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/public/public-testimonials.test.ts
 */

import assert from "node:assert/strict";
import {
  TESTIMONIAL_PUBLIC_FIELDS,
  buildApprovedTestimonialsWhere,
  sanitizeTestimonialInput,
} from "./public-testimonials";

{
  const where = buildApprovedTestimonialsWhere();
  assert.equal(where.isApproved, true);
}

{
  assert.deepEqual([...TESTIMONIAL_PUBLIC_FIELDS], [
    "id",
    "name",
    "message",
    "instagram",
    "createdAt",
  ]);
  assert.ok(!TESTIMONIAL_PUBLIC_FIELDS.includes("isApproved" as never));
}

{
  const bad = sanitizeTestimonialInput({ name: "", message: "hola" });
  assert.equal(bad.ok, false);
}

{
  const long = "x".repeat(2001);
  const bad = sanitizeTestimonialInput({ name: "Ana", message: long });
  assert.equal(bad.ok, false);
}

{
  const ok = sanitizeTestimonialInput({
    name: " Ana ",
    message: "Excelente",
    instagram: "@ana",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.name, "Ana");
    assert.equal(ok.message, "Excelente");
    assert.equal(ok.instagram, "@ana");
  }
}

console.log("public-testimonials.test.ts: ok");
