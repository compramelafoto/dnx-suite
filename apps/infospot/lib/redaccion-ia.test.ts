/**
 * Smoke de arquitectura IA (sin DB).
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/redaccion-ia.test.ts
 */
import assert from "node:assert/strict";
import {
  NEWSROOM_NAV,
  NEWSROOM_WORK_FLOW,
  newsroomNavActive,
} from "./redaccion-ia";

assert.ok(NEWSROOM_NAV.length >= 6);
assert.equal(NEWSROOM_NAV[0]!.id, "centro");
assert.ok(NEWSROOM_WORK_FLOW.includes("Qué querés contar"));
assert.ok(NEWSROOM_WORK_FLOW.includes("Escribiendo"));

assert.equal(newsroomNavActive("/redaccion", "", NEWSROOM_NAV[0]!), true);
assert.equal(
  newsroomNavActive("/redaccion/bandeja", "", NEWSROOM_NAV.find((n) => n.id === "bandeja")!),
  true,
);
assert.equal(
  newsroomNavActive(
    "/redaccion/bandeja",
    "vista=publicadas",
    NEWSROOM_NAV.find((n) => n.id === "publicados")!,
  ),
  true,
);
assert.equal(
  newsroomNavActive(
    "/redaccion/coberturas",
    "",
    NEWSROOM_NAV.find((n) => n.id === "material")!,
  ),
  true,
);
assert.equal(
  newsroomNavActive(
    "/redaccion/ayuda",
    "",
    NEWSROOM_NAV.find((n) => n.id === "ayuda")!,
  ),
  true,
);
assert.ok(NEWSROOM_NAV.some((n) => n.id === "ayuda"));

console.log("redaccion-ia tests: ok");
