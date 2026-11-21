/**
 * Tests: laboratorios sólo de directorio (sin DB).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/labs/solo-directorio.test.ts
 */

import assert from "node:assert/strict";
import { esLabSoloDirectorio, LAB_TAG_SOLO_DIRECTORIO, SIN_LABS_SOLO_DIRECTORIO } from "./solo-directorio";

assert.equal(LAB_TAG_SOLO_DIRECTORIO, "solo-directorio");
assert.deepEqual(SIN_LABS_SOLO_DIRECTORIO, { NOT: { tags: { has: "solo-directorio" } } });

// Cargado por DNX, sin cuenta: es sólo de directorio.
assert.equal(esLabSoloDirectorio({ tags: ["solo-directorio"], userId: null }), true);
// Ya tiene cuenta: deja de serlo aunque la marca haya quedado.
assert.equal(esLabSoloDirectorio({ tags: ["solo-directorio"], userId: 12 }), false);
// Laboratorio común.
assert.equal(esLabSoloDirectorio({ tags: [], userId: null }), false);
assert.equal(esLabSoloDirectorio({ tags: null }), false);

console.log("solo-directorio.test.ts: ok");
