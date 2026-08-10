/**
 * Inferencia contextual CLF.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/partners-ads-context.test.ts
 */
import assert from "node:assert/strict";
import { inferClfContextCategories } from "./partners-ads-context";

{
  const cats = inferClfContextCategories({ title: "XV de Lucía" });
  assert.ok(cats.includes("XV"));
  assert.ok(cats.includes("SOCIAL_EVENT"));
}

{
  const cats = inferClfContextCategories({ title: "Torneo de fútbol escolar" });
  assert.ok(cats.includes("SPORTS"));
  assert.ok(cats.includes("SCHOOL"));
}

{
  assert.deepEqual(inferClfContextCategories({ title: "Cumpleaños en el salón" }), ["EVENT"]);
}

console.log("partners-ads-context (clf): ok");
