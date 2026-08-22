/**
 * Selfcheck — puente de tonos entre el dominio participante y el StatusBadge.
 *   pnpm --filter fotorank run test:public-ux:status-tone
 *
 * Por qué importa: `presentRegistrationStatus` produce seis tonos y el
 * StatusBadge público entiende cinco. El desajuste no falla en runtime — un
 * tono desconocido simplemente no encuentra su clase y el estado se muestra sin
 * color. Este selfcheck recorre TODOS los estados reales de inscripción y
 * comprueba que cada uno llegue al badge con un tono que el badge sí conoce.
 */
import { presentRegistrationStatus } from "../participant-experience/status-labels";
import { toStatusBadgeTone } from "./status-tone-bridge";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

/** Los cinco tonos que el StatusBadge de public-ui sabe pintar. */
const TONOS_DEL_BADGE = new Set(["neutral", "primary", "success", "warning", "danger"]);

/* ---------- 1) Mapeo explícito de los dos tonos que no existen en el badge ---------- */
ok(toStatusBadgeTone("info") === "primary", 'tono "info" → "primary" (destaca sin implicar éxito)');
ok(toStatusBadgeTone("locked") === "neutral", 'tono "locked" → "neutral" (inmovilizado, no es error)');

/* ---------- 2) Los cuatro tonos compartidos no se alteran ---------- */
for (const tono of ["neutral", "success", "warning", "danger"] as const) {
  ok(toStatusBadgeTone(tono) === tono, `tono "${tono}" se conserva sin cambios`);
}

/* ---------- 3) Cobertura: todo tono posible produce un tono válido ---------- */
for (const tono of ["neutral", "success", "warning", "danger", "info", "locked"] as const) {
  ok(
    TONOS_DEL_BADGE.has(toStatusBadgeTone(tono)),
    `"${tono}" produce un tono que el StatusBadge sabe pintar`,
  );
}

/* ---------- 4) Estados reales de inscripción, de punta a punta ---------- */
/**
 * Son los estados que puede tener una inscripción y que la página de
 * inscripción muestra en el badge. Se recorren todos para que agregar un
 * estado nuevo con un tono no contemplado rompa acá y no en la pantalla.
 */
const ESTADOS_DE_INSCRIPCION = [
  "DRAFT",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CANCELLED",
  "DISQUALIFIED",
];

for (const estado of ESTADOS_DE_INSCRIPCION) {
  const presentado = presentRegistrationStatus(estado);
  const tonoBadge = toStatusBadgeTone(presentado.tone);

  ok(TONOS_DEL_BADGE.has(tonoBadge), `estado ${estado} → tono válido para el badge ("${tonoBadge}")`);
  ok(presentado.label.length > 0, `estado ${estado} → tiene etiqueta pública`);
  // Nunca el enum crudo: el participante no debe leer "PENDING_PAYMENT".
  ok(presentado.label !== estado, `estado ${estado} → la etiqueta no es el enum crudo`);
}

/* ---------- 5) Semántica de los estados críticos ---------- */
ok(
  toStatusBadgeTone(presentRegistrationStatus("CONFIRMED").tone) === "success",
  "inscripción confirmada se muestra como éxito",
);
for (const estado of ["CANCELLED", "DISQUALIFIED"]) {
  ok(
    toStatusBadgeTone(presentRegistrationStatus(estado).tone) === "danger",
    `${estado} se muestra como estado adverso, no neutro`,
  );
}
for (const estado of ["DRAFT", "PENDING_PAYMENT"]) {
  ok(
    toStatusBadgeTone(presentRegistrationStatus(estado).tone) === "warning",
    `${estado} se muestra como pendiente de acción`,
  );
}

/* ---------- 6) Estado desconocido: degrada, no rompe ---------- */
const desconocido = presentRegistrationStatus("UN_ESTADO_QUE_NO_EXISTE");
ok(desconocido.label.length > 0, "un estado desconocido igual devuelve una etiqueta");
ok(
  TONOS_DEL_BADGE.has(toStatusBadgeTone(desconocido.tone)),
  "un estado desconocido igual produce un tono válido (no deja el badge sin color)",
);

console.log("FINAL: PASS");
