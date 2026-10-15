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
  resolvePolicyMaxEntries,
  resolveCategoryEntryLimits,
  resolveRegistrationEntryLimit,
} from "./entry-quota";
import { allowsMultipleCategories, withMultipleCategories } from "./upload-policy";

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

// ===========================================================================
// 4. ORIGEN DEL LÍMITE — política explícita o "Máx. archivos" de la categoría
// ===========================================================================

// Retratos del mundo 2026: sin política y categorías con 3 → 3 obras.
// Antes caía al default de 1 aunque el organizador hubiera configurado 3.
assert.equal(resolvePolicyMaxEntries(null, 3), 3);
assert.equal(resolvePolicyMaxEntries({}, 3), 3);
assert.equal(resolvePolicyMaxEntries({ publicUploadOpen: true }, 3), 3);

// Santa Fe en Foco: política explícita de 1 manda sobre la categoría.
assert.equal(resolvePolicyMaxEntries({ maxEntriesPerRegistration: 1 }, 1), 1);
assert.equal(resolvePolicyMaxEntries({ maxEntriesPerRegistration: 1 }, 3), 1);
assert.equal(resolvePolicyMaxEntries({ maxEntriesPerRegistration: 2 }, 5), 2);

// Sin política ni categoría válida → default histórico.
assert.equal(resolvePolicyMaxEntries(null, null), DEFAULT_MAX_ENTRIES_PER_REGISTRATION);
assert.equal(resolvePolicyMaxEntries(null, 0), DEFAULT_MAX_ENTRIES_PER_REGISTRATION);
assert.equal(resolvePolicyMaxEntries(null, 1.5), DEFAULT_MAX_ENTRIES_PER_REGISTRATION);

// Una política inválida no se ignora a favor de la categoría: falla cerrado a 1.
assert.equal(resolvePolicyMaxEntries({ maxEntriesPerRegistration: "3" }, 3), DEFAULT_MAX_ENTRIES_PER_REGISTRATION);
assert.equal(resolvePolicyMaxEntries({ maxEntriesPerRegistration: 0 }, 3), DEFAULT_MAX_ENTRIES_PER_REGISTRATION);

// El tope absoluto también aplica al valor de la categoría.
assert.equal(
  resolveEntryQuota({ policyMaxEntries: resolvePolicyMaxEntries(null, 500), currentEntryCount: 0 }).limit,
  ABSOLUTE_MAX_ENTRIES_PER_REGISTRATION,
);

// Lo que se le muestra al participante coincide con la puerta.
assert.equal(resolveRegistrationEntryLimit({ uploadPolicyJson: null, categoryMaxFiles: 3 }), 3);
assert.equal(
  resolveRegistrationEntryLimit({ uploadPolicyJson: null, categoryMaxFiles: 3, purchasedEntriesCount: 2 }),
  2,
);
assert.equal(
  resolveRegistrationEntryLimit({ uploadPolicyJson: { maxEntriesPerRegistration: 1 }, categoryMaxFiles: 3 }),
  1,
);

// ===========================================================================
// 5. VARIAS CATEGORÍAS POR INSCRIPCIÓN — interruptor del concurso
// ===========================================================================

// Apagado por defecto: ningún concurso existente cambia.
assert.equal(allowsMultipleCategories(null), false);
assert.equal(allowsMultipleCategories({}), false);
assert.equal(allowsMultipleCategories({ maxEntriesPerRegistration: 1 }), false);
assert.equal(allowsMultipleCategories({ allowMultipleCategories: "true" }), false, "sólo un booleano real lo enciende");
assert.equal(allowsMultipleCategories({ allowMultipleCategories: true }), true);

// Encenderlo sobre un concurso sin política (Retratos) NO inventa un cupo:
// el límite por foto sigue saliendo del "Máx. archivos" de cada categoría.
const encendido = withMultipleCategories(null, true);
assert.equal(allowsMultipleCategories(encendido), true);
assert.equal(resolvePolicyMaxEntries(encendido, 3), 3);
assert.deepEqual(Object.keys(encendido), ["allowMultipleCategories"]);

// Sobre una política existente conserva el resto de las claves.
const conPolitica = withMultipleCategories({ maxEntriesPerRegistration: 2, publicUploadOpen: true }, true);
assert.equal(resolvePolicyMaxEntries(conPolitica, 3), 2);
assert.equal((conPolitica as { publicUploadOpen?: boolean }).publicUploadOpen, true);

// Apagarlo quita la clave en lugar de dejar `false`.
assert.equal("allowMultipleCategories" in withMultipleCategories(encendido, false), false);

// Cupos que ve el participante, por categoría.
const cats = [
  { id: "color", name: "Color", slug: "color", maxFiles: 3 },
  { id: "mono", name: "Monocromo", slug: "monocromo", maxFiles: 3 },
];
// Sin el interruptor: sólo la categoría de la inscripción.
assert.deepEqual(
  resolveCategoryEntryLimits({ uploadPolicyJson: null, registrationCategoryId: "mono", categories: cats }).map((c) => [c.categoryId, c.limit]),
  [["mono", 3]],
);
// Con el interruptor: todas, empezando por la de la inscripción, 3 en cada una.
assert.deepEqual(
  resolveCategoryEntryLimits({
    uploadPolicyJson: { allowMultipleCategories: true },
    registrationCategoryId: "mono",
    categories: cats,
  }).map((c) => [c.categoryId, c.limit]),
  [["mono", 3], ["color", 3]],
);

console.log("entry-quota.selfcheck.ts OK — compatibilidad, cupo por paquete, config inválida y origen del límite");
