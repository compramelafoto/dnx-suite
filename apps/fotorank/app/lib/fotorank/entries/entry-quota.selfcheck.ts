/**
 * Selfcheck del cupo de obras por inscripción.
 *
 * El foco está en la compatibilidad: los concursos que ya están en producción
 * NO deben cambiar de comportamiento al quitar el índice único de la base.
 *
 * Uso: pnpm --filter fotorank test:entry-quota:selfcheck
 */
import assert from "node:assert/strict";

import {
  ABSOLUTE_MAX_ENTRIES_PER_REGISTRATION,
  DEFAULT_MAX_ENTRIES_PER_REGISTRATION,
  canCreateEntry,
  resolveEntryQuota,
} from "./entry-quota";

// ===========================================================================
// 1. COMPATIBILIDAD — concursos ya existentes
// ===========================================================================

// Un concurso sin configuración se comporta como antes: una sola obra.
assert.equal(DEFAULT_MAX_ENTRIES_PER_REGISTRATION, 1);

const legacyEmpty = resolveEntryQuota({ currentEntryCount: 0 });
assert.equal(legacyEmpty.limit, 1);
assert.equal(legacyEmpty.canCreateMore, true);

// Con una obra cargada ya no puede subir más — igual que con el @unique.
const legacyUsed = resolveEntryQuota({ currentEntryCount: 1 });
assert.equal(legacyUsed.limit, 1);
assert.equal(legacyUsed.remaining, 0);
assert.equal(legacyUsed.canCreateMore, false);

// Santa Fe en Foco: política explícita de 1, inscripciones sin cupo comprado.
const santaFe = canCreateEntry({
  policyMaxEntries: 1,
  purchasedEntriesCount: null,
  currentEntryCount: 1,
});
assert.equal(santaFe.allowed, false);
assert.equal(!santaFe.allowed && santaFe.reason, "QUOTA_EXCEEDED");
// El mensaje del caso de 1 obra no habla de "máximo de N".
assert.equal(
  !santaFe.allowed && santaFe.message,
  "Ya cargaste tu fotografía para este concurso.",
);

// La primera obra siempre se puede cargar.
assert.equal(
  canCreateEntry({ policyMaxEntries: 1, currentEntryCount: 0 }).allowed,
  true,
);

// ===========================================================================
// 2. Concursos nuevos con varias obras
// ===========================================================================

// Política de 3 obras, sin pago por paquete: se pueden cargar las 3.
for (let n = 0; n < 3; n += 1) {
  assert.equal(
    canCreateEntry({ policyMaxEntries: 3, currentEntryCount: n }).allowed,
    true,
    `debería permitir la obra ${n + 1}`,
  );
}
const fourth = canCreateEntry({ policyMaxEntries: 3, currentEntryCount: 3 });
assert.equal(fourth.allowed, false);
assert.equal(
  !fourth.allowed && fourth.message,
  "Alcanzaste el máximo de 3 fotografías para tu inscripción.",
);

// ===========================================================================
// 3. El pago restringe, nunca amplía
// ===========================================================================

// Compró 2 aunque la política admite 3: sólo puede subir 2.
const bought2 = resolveEntryQuota({
  policyMaxEntries: 3,
  purchasedEntriesCount: 2,
  currentEntryCount: 0,
});
assert.equal(bought2.limit, 2);
assert.equal(
  canCreateEntry({ policyMaxEntries: 3, purchasedEntriesCount: 2, currentEntryCount: 2 }).allowed,
  false,
);

// Un pago no puede habilitar más de lo que el concurso permite.
const overbought = resolveEntryQuota({
  policyMaxEntries: 2,
  purchasedEntriesCount: 10,
  currentEntryCount: 0,
});
assert.equal(overbought.limit, 2, "el pago no puede ampliar el límite del concurso");

// Los tres paquetes del concurso.
assert.equal(resolveEntryQuota({ policyMaxEntries: 3, purchasedEntriesCount: 1, currentEntryCount: 0 }).limit, 1);
assert.equal(resolveEntryQuota({ policyMaxEntries: 3, purchasedEntriesCount: 2, currentEntryCount: 0 }).limit, 2);
assert.equal(resolveEntryQuota({ policyMaxEntries: 3, purchasedEntriesCount: 3, currentEntryCount: 0 }).limit, 3);

// ===========================================================================
// 4. Configuración inválida — falla cerrado
// ===========================================================================

// Valores absurdos caen al default de 1 en vez de habilitar de más.
for (const bad of [0, -5, 1.5, Number.NaN]) {
  assert.equal(
    resolveEntryQuota({ policyMaxEntries: bad, currentEntryCount: 0 }).limit,
    1,
    `policyMaxEntries=${bad} debe caer al default`,
  );
}

// Un tope absoluto impide que una configuración errónea habilite miles de obras.
assert.equal(
  resolveEntryQuota({ policyMaxEntries: 9999, currentEntryCount: 0 }).limit,
  ABSOLUTE_MAX_ENTRIES_PER_REGISTRATION,
);

// Un contador de obras negativo no genera cupo extra.
const negative = resolveEntryQuota({ policyMaxEntries: 3, currentEntryCount: -2 });
assert.equal(negative.used, 0);
assert.equal(negative.remaining, 3);

// Más obras que el límite (dato inconsistente) no habilita ninguna más.
const over = resolveEntryQuota({ policyMaxEntries: 2, currentEntryCount: 5 });
assert.equal(over.remaining, 0);
assert.equal(over.canCreateMore, false);

// El cupo restante se informa correctamente.
const partial = canCreateEntry({ policyMaxEntries: 3, currentEntryCount: 1 });
assert.equal(partial.allowed, true);
assert.equal(partial.allowed && partial.remainingAfter, 1);

console.log("entry-quota.selfcheck.ts OK — compatibilidad, cupo por paquete y config inválida");
