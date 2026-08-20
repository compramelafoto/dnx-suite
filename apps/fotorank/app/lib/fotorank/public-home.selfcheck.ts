/**
 * Selfcheck — filtrado público de concursos en la home.
 *   pnpm --filter fotorank run test:public-home
 *
 * Prueba de regresión para la migración de la home al sistema public-ui
 * (9d31b153): la estructura visual cambió por completo, pero la regla de qué
 * concursos son visibles NO debe cambiar. `getStatusLabel` decide la etiqueta
 * y `listPublicHomeContests` descarta los "Cerrado" — esa combinación es el
 * contrato público que este archivo fija.
 *
 * No toca la DB: `getStatusLabel` es pura.
 */
import assert from "node:assert/strict";
import { getStatusLabel } from "./publicContests";

const NOW = new Date("2026-08-20T12:00:00.000Z");
const PAST = new Date("2026-08-01T12:00:00.000Z");
const FUTURE = new Date("2026-09-30T12:00:00.000Z");

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

// 1) Deadline pasado → "Cerrado" (y por lo tanto se filtra fuera de la home).
ok(
  getStatusLabel(NOW, PAST, PAST) === "Cerrado",
  'deadline vencido → "Cerrado" (queda fuera de la home)',
);

// 2) Apertura futura → "Próximamente" (visible, no se filtra).
ok(
  getStatusLabel(NOW, FUTURE, FUTURE) === "Próximamente",
  'apertura futura → "Próximamente" (sigue visible)',
);

// 3) Abierto: ya empezó y el deadline no pasó.
ok(
  getStatusLabel(NOW, PAST, FUTURE) === "Inscripciones abiertas",
  'ya iniciado y deadline futuro → "Inscripciones abiertas"',
);

// 4) Sin fechas → visible como abierto, nunca "Cerrado" por ausencia de datos.
ok(
  getStatusLabel(NOW, null, null) === "Inscripciones abiertas",
  'sin fechas → "Inscripciones abiertas", nunca se oculta por datos faltantes',
);

// 5) Sin deadline pero con apertura futura → "Próximamente".
ok(
  getStatusLabel(NOW, FUTURE, null) === "Próximamente",
  'sin deadline y apertura futura → "Próximamente"',
);

// 6) El deadline manda sobre la apertura: si venció, está cerrado aunque
//    la apertura también fuese futura (datos inconsistentes no lo reabren).
ok(
  getStatusLabel(NOW, FUTURE, PAST) === "Cerrado",
  "deadline vencido tiene prioridad sobre apertura futura",
);

// 7) Deadline exactamente ahora no se considera vencido (cierre inclusivo):
//    coherente con el criterio de cierre de SFEF.
ok(
  getStatusLabel(NOW, PAST, NOW) === "Inscripciones abiertas",
  "deadline == ahora todavía NO está cerrado (cierre inclusivo)",
);

console.log("FINAL: PASS");
