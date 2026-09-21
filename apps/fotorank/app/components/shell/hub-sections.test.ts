/**
 * El menú del hub personal se arma según lo que cada persona puede hacer de verdad.
 *
 * Es la única navegación de FotoRank que ya era dinámica, y acá se conserva al pasarla al
 * armazón común. Lo que se prueba es lo que importa: que nadie vea una puerta que no puede
 * abrir, y que quien sí puede la vea.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { seccionesDelHub } from "./hub-sections";

const SIN_NADA = {
  isSuperAdmin: false,
  hasParticipations: false,
  hasOrganizations: false,
  hasJuryAccount: false,
  kinds: [] as string[],
};

function hrefs(secciones: ReturnType<typeof seccionesDelHub>) {
  return secciones.flatMap((s) => s.items.map((i) => i.href));
}

test("quien recién llega ve su actividad y la invitación a participar", () => {
  // Sin capacidades todavía: el layout viejo mostraba Participaciones igual, para no dejar
  // la pantalla en blanco. Se conserva ese criterio.
  assert.deepEqual(hrefs(seccionesDelHub(SIN_NADA)), ["/mi-actividad", "/participaciones"]);
});

test("quien participa ve sus participaciones", () => {
  const s = seccionesDelHub({ ...SIN_NADA, hasParticipations: true, kinds: ["participant"] });
  assert.ok(hrefs(s).includes("/participaciones"));
});

test("quien no participa y ya tiene otra cosa no ve participaciones", () => {
  const s = seccionesDelHub({ ...SIN_NADA, hasOrganizations: true, kinds: ["organizer"] });
  assert.equal(hrefs(s).includes("/participaciones"), false);
});

test("quien organiza ve el panel de su organización", () => {
  const s = seccionesDelHub({ ...SIN_NADA, hasOrganizations: true, kinds: ["organizer"] });
  assert.ok(hrefs(s).includes("/dashboard"));
});

test("quien es jurado ve sus tareas de jurado", () => {
  const s = seccionesDelHub({ ...SIN_NADA, hasJuryAccount: true, kinds: ["judge"] });
  assert.ok(hrefs(s).includes("/jurado/panel"));
});

test("el super administrador ve la plataforma, y nadie más", () => {
  const conPoder = seccionesDelHub({ ...SIN_NADA, isSuperAdmin: true });
  assert.ok(hrefs(conPoder).includes("/super-admin"));
  assert.ok(hrefs(conPoder).includes("/super-admin/jurados"));

  const sinPoder = seccionesDelHub({ ...SIN_NADA, hasOrganizations: true, kinds: ["organizer"] });
  assert.equal(
    hrefs(sinPoder).some((h) => h.startsWith("/super-admin")),
    false,
  );
});

test("no se dibuja una sección vacía", () => {
  for (const seccion of seccionesDelHub(SIN_NADA)) {
    assert.ok(seccion.items.length > 0, `la sección "${seccion.title}" quedó vacía`);
  }
});
