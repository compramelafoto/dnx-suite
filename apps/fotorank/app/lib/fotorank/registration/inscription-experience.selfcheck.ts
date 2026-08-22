/**
 * Selfcheck — reconciliación de la experiencia pública de inscripción.
 *   pnpm --filter fotorank run test:inscription:experience
 *
 * Qué protege: el restyle a public-ui reescribió el formulario y la página
 * completos. El riesgo real no es que se vea mal, sino que al reescribir el
 * markup se pierda en silencio una regla productiva — un campo obligatorio, un
 * consentimiento, un gate legal — sin que el build ni los tipos se quejen.
 *
 * El proyecto no tiene runner de React DOM: los tests son estáticos o de
 * lógica pura. Por eso esto analiza el fuente en vez de renderizar. No
 * reemplaza al QA visual, pero sí impide que una regla desaparezca del código.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP = join(process.cwd(), "../../apps/fotorank/app");
const FORM = readFileSync(join(APP, "concursos/[slug]/inscripcion/InscriptionForm.tsx"), "utf8");
const PAGE = readFileSync(join(APP, "concursos/[slug]/inscripcion/page.tsx"), "utf8");
const WIZARD = readFileSync(join(APP, "components/participant-upload/ParticipantUploadWizard.tsx"), "utf8");

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

/** Cuenta ocurrencias no solapadas de una cadena literal. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/* ---------- 1) Campos del formulario que deben seguir existiendo ---------- */
for (const testid of [
  "inscription-form",
  "inscription-category",
  "inscription-age",
  "inscription-accept-rules",
  "inscription-accept-license",
  "inscription-promo-optin",
  "inscription-submit",
  "inscription-success",
  "registration-number",
  "category-hint",
  "open-participation-note",
]) {
  ok(FORM.includes(`data-testid="${testid}"`), `el formulario conserva "${testid}"`);
}

/* ---------- 2) Las cuatro categorías siguen descritas ---------- */
for (const [etiqueta, slug] of [
  ["Profesional", "fotografo-profesional"],
  ["Amateur", "fotografo-amateur"],
  ["Reportero gráfico", "reportero-grafico"],
  ["Aérea (dron)", "fotografia-aerea"],
] as const) {
  ok(FORM.includes(`"${slug}"`), `categoría ${etiqueta} conserva su descripción ("${slug}")`);
}
// Alias históricos: los concursos viejos usan slugs cortos.
for (const alias of ["profesional:", "amateur:", '"fotografia-aerea-dron"']) {
  ok(FORM.includes(alias), `se conserva el alias de categoría ${alias.replace(/[":]/g, "")}`);
}

/* ---------- 3) ARGRA: obligatorio y sólo en Reportero gráfico ---------- */
ok(FORM.includes("function requiresArgra"), "se conserva el predicado de ARGRA");
ok(
  FORM.includes('slug === "reportero-grafico"') && FORM.includes('slug.includes("reportero")'),
  "ARGRA se activa por slug exacto y por variante que contenga 'reportero'",
);
ok(
  FORM.includes("needsArgra && !argraMembershipNumber.trim()"),
  "ARGRA vacío bloquea el envío cuando la categoría lo requiere",
);
ok(
  FORM.includes("{needsArgra ? (") && FORM.includes('data-testid="inscription-argra"'),
  "el campo ARGRA se muestra sólo cuando corresponde",
);

/* ---------- 4) Consentimientos: qué es obligatorio y qué no ---------- */
ok(FORM.includes("!acceptedRules"), "no aceptar las Bases bloquea el envío");
ok(FORM.includes("!acceptedLicense"), "no aceptar la licencia bloquea el envío");
/**
 * El opt-in promocional debe seguir siendo OPCIONAL. Si alguna vez se colara
 * en la validación, se convertiría en consentimiento forzado.
 */
ok(
  !FORM.includes("!promotionalOptIn"),
  "el consentimiento promocional NO bloquea el envío (sigue siendo opcional)",
);
ok(FORM.includes("promotionalOptIn,"), "el opt-in promocional se sigue enviando al servidor");

/* ---------- 5) Aceptación de Bases: versión y trazabilidad ---------- */
ok(FORM.includes("rulesVersionId: rules.id"), "se envía la versión exacta de Bases aceptada");
ok(FORM.includes("rulesAccepted: true") && FORM.includes("licenseAccepted: true"),
  "se envían ambas aceptaciones por separado");
ok(
  FORM.includes("<RulesDocument content={rules.content} />"),
  "las Bases se muestran formateadas (RulesDocument), no en crudo",
);
// Se busca la clase dentro de un className real: mencionarla en un comentario
// no debe contar como uso.
ok(
  !/className=\{?["'][^"']*whitespace-pre-wrap/.test(FORM),
  "ya no se vuelca el Markdown crudo con whitespace-pre-wrap",
);

/* ---------- 6) Menores de edad ---------- */
ok(FORM.includes("ageNum >= 16 && ageNum < 18"), "la franja 16-17 sigue requiriendo autorización");
ok(
  FORM.includes("!minorAccepted || !guardianName.trim() || !relationship.trim()"),
  "la autorización de menor exige declaración, adulto responsable y vínculo",
);
ok(FORM.includes("MINOR_CONSENT_NOTICE"), "se conserva el texto legal de consentimiento de menor");

/* ---------- 7) Instagram: la regla vive en la carga, no en la inscripción ---------- */
ok(
  !FORM.includes("instagramHandle"),
  "el formulario de inscripción NO pide Instagram (la API no acepta el campo)",
);
ok(WIZARD.includes('data-testid="entry-instagram"'), "el wizard de carga sí pide Instagram");
ok(
  WIZARD.includes("!workData.instagramHandle.trim()"),
  "el wizard valida Instagram antes de avanzar (evita fallar recién al subir)",
);
ok(
  WIZARD.includes('return "Indicá tu usuario de Instagram.";'),
  "el mensaje del wizard coincide con el del servidor (INSTAGRAM_REQUIRED)",
);

/* ---------- 8) Doble submit / doble confirmación ---------- */
ok(FORM.includes("disabled={pending}"), "el botón de inscripción se deshabilita mientras envía");
ok(FORM.includes("loading={pending}"), "el botón expone estado de carga accesible");
ok(
  WIZARD.includes("setConfirmOpen(false);") && WIZARD.includes("void performUploadAndConfirm();"),
  "el modal se cierra antes de disparar el envío (no admite doble confirmación)",
);

/* ---------- 9) Montaje único del wizard y del modal ---------- */
ok(
  count(PAGE, "<ParticipantUploadWizard") === 1,
  "el wizard se monta exactamente una vez en la página de inscripción",
);
ok(
  count(WIZARD, "<UploadConfirmModal") === 1,
  "el modal de confirmación se monta exactamente una vez dentro del wizard",
);
// Montaje real: JSX o import. Nombrarlo en un comentario no cuenta.
ok(
  !PAGE.includes("<EntryUploadPanel") && !/import\s*\{[^}]*EntryUploadPanel/.test(PAGE),
  "EntryUploadPanel ya no se monta ni se importa (el wizard lo reemplaza)",
);

/* ---------- 10) Continuidad de los data-testid que verifican los e2e ---------- */
/**
 * El wizard reemplaza a EntryUploadPanel. Para no romper los e2e existentes
 * debe seguir exponiendo los mismos identificadores.
 */
for (const testid of [
  "entry-upload-panel",
  "entry-capture-locality",
  "entry-capture-department",
  "entry-territory-confirm",
  "entry-period-confirm",
  "entry-device-kind",
  "entry-device-make",
  "entry-device-model",
  "entry-drone-ack",
  "entry-file-input",
  "entry-preview",
  "entry-processing",
  "entry-confirm",
  "entry-status-block",
  "admission-public-status",
  "upload-closed-notice",
]) {
  ok(WIZARD.includes(`data-testid="${testid}"`), `el wizard conserva "${testid}" para los e2e`);
}

/**
 * Con la carga cerrada el wizard devuelve el aviso SIN exponer
 * `entry-upload-panel`. El e2e de go-live verifica exactamente eso: aviso
 * visible y panel con count 0.
 */
{
  const closed = WIZARD.slice(
    WIZARD.indexOf("if (!requirements.uploadWindow.isOpen"),
    WIZARD.indexOf('data-testid="entry-upload-panel"'),
  );
  ok(closed.includes('data-testid="upload-closed-notice"'), "carga cerrada → emite el aviso");
  ok(
    !closed.includes('data-testid="entry-upload-panel"'),
    "carga cerrada → NO expone entry-upload-panel (go-live espera count 0)",
  );
}

/* ---------- 11) Autenticación y navegación posterior al login ---------- */
ok(PAGE.includes("const user = await getAuthUser();"), "la página exige sesión");
ok(
  PAGE.includes("redirect(`/login?next=${encodeURIComponent(loginNext)}`)"),
  "sin sesión redirige a login con destino de retorno",
);
ok(
  PAGE.includes("const loginNext = `/concursos/${slug}/inscripcion`"),
  "el destino de retorno es la propia inscripción",
);
/**
 * `next` se sanea en el destino con `safeNextPath` (login/crear-cuenta). Se fija
 * acá para que el saneo no se pierda al reescribir esas páginas.
 */
{
  const login = readFileSync(join(APP, "login/page.tsx"), "utf8");
  ok(login.includes("safeNextPath("), "login sanea el parámetro next antes de usarlo");
  ok(
    login.includes("classifyFailure") && login.includes("FOTORANK_LOGIN_REVISIT_FAILURE"),
    "login conserva el manejo de fallos del fix de post-login",
  );
}

/* ---------- 12) Visibilidad y estado del concurso ---------- */
ok(
  PAGE.includes('visibility: { in: ["PUBLIC", "UNLISTED"] }') &&
    PAGE.includes('status: { in: ["PUBLISHED", "ACTIVE"] }'),
  "sólo se inscribe en concursos públicos/no listados y publicados/activos",
);
ok(
  PAGE.includes('where: { status: "ACTIVE" }'),
  "sólo se ofrecen categorías activas",
);
ok(
  PAGE.includes('existing.status !== "CANCELLED" && existing.status !== "DISQUALIFIED"'),
  "una inscripción cancelada o descalificada no bloquea una nueva",
);
ok(
  PAGE.includes('existing.status === "CONFIRMED" && requirements'),
  "el wizard sólo aparece con la inscripción confirmada",
);

/* ---------- 13) Bases no publicadas ---------- */
ok(
  PAGE.includes("Bases no publicadas") && PAGE.includes("{!rules ? ("),
  "sin Bases publicadas no se muestra el formulario",
);

console.log("FINAL: PASS");
