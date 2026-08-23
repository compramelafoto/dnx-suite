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
import { resolveRegistrationCloseLabel } from "./contest-public-presentation";
import {
  getStatusLabel,
  looksLikeTestEdition,
  sortHomeCards,
  toPublicHomeContestCard,
} from "./publicContests";

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

/* ==========================================================================
   IMAGEN DE LA TARJETA — precedencia compartida con la landing
   ==========================================================================
   La tarjeta mostraba solo texto aunque el concurso tuviera banner curado. La
   resolución usa `resolveContestVisualTheme`, el mismo resolvedor de la
   landing, para que la regla no quede duplicada ni dependa de ningún slug
   escrito en el componente visual.
   ========================================================================== */

const BASE_CARD = {
  title: "Concurso de prueba",
  organizerName: "Organización",
  coverImageUrl: null as string | null,
  registrationClosesAt: null as Date | null,
  submissionDeadline: FUTURE,
  startAt: PAST,
  categoriesCount: 4,
  now: NOW,
};

// 1) Santa Fe en Foco toma su hero institucional del manifiesto curado.
const sfef = toPublicHomeContestCard({ ...BASE_CARD, slug: "santa-fe-en-foco", title: "Santa Fe en Foco 2026" });
ok(
  sfef.heroImageUrl === "/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg",
  "Santa Fe en Foco: la tarjeta usa el hero institucional del manifiesto",
);
ok(sfef.heroImageAlt.trim().length > 0, "Santa Fe en Foco: la imagen tiene texto alternativo");
ok(
  !/^imagen$/i.test(sfef.heroImageAlt.trim()),
  "el texto alternativo no es genérico: describe el concurso",
);

// 2) El manifiesto curado gana sobre una portada configurada en base.
const sfefConCover = toPublicHomeContestCard({
  ...BASE_CARD,
  slug: "santa-fe-en-foco",
  coverImageUrl: "https://cdn.example/otra-portada.jpg",
});
ok(
  sfefConCover.heroImageUrl === "/contest-assets/santa-fe-en-foco/hero/hero-desktop.jpg",
  "el asset curado tiene prioridad sobre coverImageUrl",
);

// 3) Otro concurso con portada configurada usa su propia portada.
const otro = toPublicHomeContestCard({
  ...BASE_CARD,
  slug: "otro-concurso",
  title: "Otro concurso",
  coverImageUrl: "https://cdn.example/portada.jpg",
});
ok(
  otro.heroImageUrl === "https://cdn.example/portada.jpg",
  "concurso con coverImageUrl: la tarjeta usa su portada configurada",
);

// 4) Sin ninguna imagen se conserva el fallback tipográfico (null, no vacío).
const sinImagen = toPublicHomeContestCard({ ...BASE_CARD, slug: "concurso-sin-imagen" });
ok(sinImagen.heroImageUrl === null, "concurso sin imagen: heroImageUrl es null (fallback tipográfico)");
ok(
  sinImagen.heroImageAlt.trim().length > 0,
  "aun sin imagen el alt queda definido (no rompe si más adelante se agrega una)",
);

// 5) El branding de Santa Fe NO se filtra a otros concursos.
for (const slug of ["otro-concurso", "santa-fe-en-una-foto", "concurso-sin-imagen"]) {
  const card = toPublicHomeContestCard({ ...BASE_CARD, slug, coverImageUrl: null });
  ok(
    card.heroImageUrl === null || !card.heroImageUrl.includes("santa-fe-en-foco"),
    `"${slug}" no hereda los assets de Santa Fe en Foco`,
  );
}

/* ==========================================================================
   FECHA DE CIERRE — misma etiqueta pública en home y landing
   ==========================================================================
   El instante guardado es EXCLUSIVO (1-oct 00:00 ART) porque así se calcula si
   la inscripción sigue abierta; lo publicado legalmente es el último día
   INCLUSIVO (30 de septiembre). La home formateaba el instante crudo y por eso
   mostraba una fecha distinta de la landing.
   ========================================================================== */

/** Cierre exclusivo real de SFEF: 1-oct-2026 00:00 ART = 03:00 UTC. */
const SFEF_CIERRE_EXCLUSIVO = new Date("2026-10-01T03:00:00.000Z");

// 1) Santa Fe en Foco muestra la fecha publicada, no el instante crudo.
const sfefFecha = toPublicHomeContestCard({
  ...BASE_CARD,
  slug: "santa-fe-en-foco",
  registrationClosesAt: SFEF_CIERRE_EXCLUSIVO,
  submissionDeadline: SFEF_CIERRE_EXCLUSIVO,
});
ok(
  sfefFecha.registrationCloseLabel === "30 de septiembre de 2026",
  'la home muestra "30 de septiembre de 2026" (fecha publicada, inclusiva)',
);
ok(
  !String(sfefFecha.registrationCloseLabel).includes("octubre"),
  "la home ya NO muestra 1 de octubre",
);

// 2) Home y landing resuelven la MISMA etiqueta: una sola fuente.
ok(
  sfefFecha.registrationCloseLabel ===
    resolveRegistrationCloseLabel({
      slug: "santa-fe-en-foco",
      registrationClosesAt: SFEF_CIERRE_EXCLUSIVO,
      submissionDeadline: SFEF_CIERRE_EXCLUSIVO,
    }),
  "home y landing usan la misma función de presentación (sin duplicar la regla)",
);

// 3) El instante almacenado NO se modifica: se sigue exponiendo crudo.
ok(
  sfefFecha.submissionDeadline?.toISOString() === "2026-10-01T03:00:00.000Z",
  "el instante exclusivo almacenado sigue siendo 1-oct-2026 00:00 ART (sin alterar)",
);

// 4) El cálculo de estado no cambia: durante todo el 30/09 sigue abierta.
const during30Sep = new Date("2026-09-30T23:59:00.000Z");
ok(
  getStatusLabel(during30Sep, PAST, SFEF_CIERRE_EXCLUSIVO) === "Inscripciones abiertas",
  "el 30 de septiembre la inscripción sigue abierta (cierre inclusivo preservado)",
);
const after = new Date("2026-10-01T04:00:00.000Z");
ok(
  getStatusLabel(after, PAST, SFEF_CIERRE_EXCLUSIVO) === "Cerrado",
  "pasado el instante exclusivo el concurso queda cerrado",
);

// 5) Otros concursos conservan su fecha normal, sin override.
const otroFecha = toPublicHomeContestCard({
  ...BASE_CARD,
  slug: "otro-concurso",
  registrationClosesAt: new Date("2026-11-15T03:00:00.000Z"),
});
ok(
  String(otroFecha.registrationCloseLabel).includes("noviembre"),
  "un concurso sin override muestra su propia fecha formateada",
);
ok(
  otroFecha.registrationCloseLabel !== "30 de septiembre de 2026",
  "el override de Santa Fe no se aplica a otros concursos",
);

// 6) Sin fechas no se inventa ninguna etiqueta.
ok(
  toPublicHomeContestCard({ ...BASE_CARD, slug: "sin-fechas", submissionDeadline: null })
    .registrationCloseLabel === null,
  "sin fechas la etiqueta de cierre es null (no se inventa)",
);

// 7) `registrationClosesAt` manda sobre `submissionDeadline` cuando existe.
const conAmbas = toPublicHomeContestCard({
  ...BASE_CARD,
  slug: "otro-concurso",
  registrationClosesAt: new Date("2026-11-15T03:00:00.000Z"),
  submissionDeadline: new Date("2026-12-20T03:00:00.000Z"),
});
ok(
  String(conAmbas.registrationCloseLabel).includes("noviembre"),
  "el cierre de inscripción tiene prioridad sobre la fecha de entrega",
);

/* ==========================================================================
   MODALIDAD Y DESTINO — concursos y maratones en una sola lista
   ==========================================================================
   La home lista dos tipos de convocatoria. El participante tiene que poder
   distinguirlas de un vistazo, y cada una tiene que llevar a su propio sitio.
   La resolución vive en esta capa y no en el componente, porque `public-ui`
   debe permanecer neutro respecto de otros productos (lo verifica
   public-ui.isolation.test.ts).
   ========================================================================== */

// 1) Por defecto, una convocatoria es un concurso: nada se vuelve maratón solo.
const concurso = toPublicHomeContestCard({ ...BASE_CARD, slug: "un-concurso" });
ok(concurso.modalityLabel === "Concurso fotográfico", "sin dato explícito → se presenta como concurso");
ok(concurso.href === "/concursos/un-concurso", "un concurso enlaza a su landing dentro de FotoRank");
ok(concurso.isExternal === false, "un concurso NO es un enlace externo");

// 2) Una maratón publicada como concurso de FotoRank se etiqueta como tal,
//    pero sigue viviendo dentro de FotoRank.
const maratonInterna = toPublicHomeContestCard({
  ...BASE_CARD,
  slug: "maraton-en-fotorank",
  experienceType: "MARATHON",
});
ok(maratonInterna.modalityLabel === "Maratón fotográfica", "experienceType MARATHON → se presenta como maratón");
ok(maratonInterna.href === "/concursos/maraton-en-fotorank", "una maratón propia enlaza dentro de FotoRank");
ok(maratonInterna.isExternal === false, "una maratón propia no es enlace externo");

// 3) Una convocatoria gestionada fuera se etiqueta y enlaza a su sitio.
const externa = toPublicHomeContestCard({
  ...BASE_CARD,
  slug: "edicion-externa",
  experienceType: "MARATHON",
  href: "https://ejemplo.test/maratones/edicion-externa",
});
ok(externa.modalityLabel === "Maratón fotográfica", "la convocatoria externa se presenta como maratón");
ok(externa.href === "https://ejemplo.test/maratones/edicion-externa", "conserva el destino externo tal cual");
ok(externa.isExternal === true, "se marca como externa para abrirla aparte");

// 4) `experienceType` nulo o ausente NO convierte nada en maratón (fail-safe).
for (const valor of [null, undefined] as const) {
  ok(
    toPublicHomeContestCard({ ...BASE_CARD, slug: "x", experienceType: valor }).modalityLabel ===
      "Concurso fotográfico",
    `experienceType ${String(valor)} → sigue siendo concurso`,
  );
}

// 5) Las dos modalidades conviven ordenadas por urgencia de cierre.
{
  const cierraTarde = toPublicHomeContestCard({
    ...BASE_CARD,
    slug: "cierra-tarde",
    title: "Cierra tarde",
    submissionDeadline: new Date("2026-12-01T03:00:00.000Z"),
  });
  const cierraPronto = toPublicHomeContestCard({
    ...BASE_CARD,
    slug: "cierra-pronto",
    title: "Cierra pronto",
    experienceType: "MARATHON",
    submissionDeadline: new Date("2026-09-05T03:00:00.000Z"),
  });
  const sinFecha = toPublicHomeContestCard({
    ...BASE_CARD,
    slug: "sin-fecha",
    title: "Sin fecha",
    submissionDeadline: null,
  });

  const ordenadas = sortHomeCards([sinFecha, cierraTarde, cierraPronto]);
  ok(ordenadas[0]?.slug === "cierra-pronto", "primero la convocatoria que cierra antes, sin importar la modalidad");
  ok(ordenadas[1]?.slug === "cierra-tarde", "después la que cierra más tarde");
  ok(ordenadas[2]?.slug === "sin-fecha", "las convocatorias sin fecha de cierre quedan al final");

  // El orden no puede depender de la modalidad: una maratón puede ir primera.
  ok(
    ordenadas[0]?.modalityLabel === "Maratón fotográfica",
    "una maratón puede encabezar la lista si es la que cierra antes",
  );
}

// 6) El listado mezcla ambas modalidades sin perder ninguna.
{
  const mezcla = sortHomeCards([
    toPublicHomeContestCard({ ...BASE_CARD, slug: "c1", title: "C1" }),
    toPublicHomeContestCard({ ...BASE_CARD, slug: "m1", title: "M1", experienceType: "MARATHON" }),
    toPublicHomeContestCard({ ...BASE_CARD, slug: "c2", title: "C2" }),
  ]);
  ok(mezcla.length === 3, "la lista conserva todas las convocatorias");
  ok(
    mezcla.filter((c) => c.modalityLabel === "Maratón fotográfica").length === 1,
    "la maratón sigue presente después de ordenar",
  );
  ok(
    mezcla.filter((c) => c.modalityLabel === "Concurso fotográfico").length === 2,
    "los concursos siguen presentes después de ordenar",
  );
}

/* ==========================================================================
   EDICIONES DE PRUEBA — no deben llegar al home público
   ==========================================================================
   Detectado en Preview: la consulta traía "Clickatón AR2026 — TEST UX" y
   "Clickatón Piloto TEST 11B", ambas publicadas y con inscripción, y las
   habría mostrado a cualquier visitante. No estaban marcadas como fixture de
   operaciones: lo único que las delataba era el nombre.
   ========================================================================== */

// Casos reales encontrados en la base de Preview.
for (const [name, slug] of [
  ["Clickatón AR2026 — TEST UX", "ar2026-commercial-ux-test"],
  ["Clickatón Piloto TEST 11B", "piloto-test-11b"],
] as const) {
  ok(looksLikeTestEdition(name, slug), `"${name}" se detecta como edición de prueba`);
}

// Otras variantes habituales, por nombre o por slug.
for (const [name, slug] of [
  ["Maratón Demo", "maraton-demo"],
  ["Edición QA", "edicion-qa"],
  ["Prueba interna", "prueba-interna"],
  ["Sandbox", "sandbox"],
  ["Edición normal", "staging-2026"],
  ["Fixture ops", "fixture-ops"],
] as const) {
  ok(looksLikeTestEdition(name, slug), `"${name}" / "${slug}" se detecta como prueba`);
}

/**
 * Y lo más importante: una convocatoria real NO puede quedar oculta por este
 * filtro. Se prueban nombres legítimos, incluidos algunos que contienen
 * subcadenas de las palabras vetadas ("Protesta" contiene "test").
 */
for (const [name, slug] of [
  ["Clickatón Argentina 2026", "clickaton-argentina-2026"],
  ["Santa Fe en Foco 2026", "santa-fe-en-foco"],
  ["Maratón Fotográfica Rosario", "maraton-rosario-2026"],
  ["Protesta social en imágenes", "protesta-social"],
  ["Detalles urbanos", "detalles-urbanos"],
  ["Contestación visual", "contestacion-visual"],
] as const) {
  ok(!looksLikeTestEdition(name, slug), `"${name}" NO se confunde con una edición de prueba`);
}

console.log("FINAL: PASS");
