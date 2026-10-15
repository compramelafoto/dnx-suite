import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPublicDate, resolveRegistrationCloseLabel } from "./registration-close";

// Correr con TZ=UTC (como Vercel): el cierre a las 23:59 de Argentina es 02:59 del día siguiente en UTC.
const CIERRE_2359_ART = new Date("2026-11-01T02:59:00.000Z");

test("la fecha pública se muestra en hora de Argentina aunque el servidor esté en UTC", () => {
  assert.equal(formatPublicDate(CIERRE_2359_ART), "31 de octubre de 2026");
});

test("respeta la zona horaria del concurso cuando se indica", () => {
  assert.equal(formatPublicDate(CIERRE_2359_ART, "UTC"), "1 de noviembre de 2026");
});

test("una zona horaria vacía cae en Argentina", () => {
  assert.equal(formatPublicDate(CIERRE_2359_ART, null), "31 de octubre de 2026");
});

test("la etiqueta de cierre usa la misma hora local", () => {
  assert.equal(
    resolveRegistrationCloseLabel({ slug: "retratos-del-mundo-2026", registrationClosesAt: CIERRE_2359_ART }),
    "31 de octubre de 2026",
  );
});
