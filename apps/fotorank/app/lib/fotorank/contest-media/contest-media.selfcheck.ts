/**
 * Selfcheck — imágenes de concurso cargadas desde el administrador.
 *   pnpm --filter fotorank run test:contest-media
 *
 * Cubre las tres cosas que, si se rompen, no fallan en runtime sino que fallan
 * en silencio y mal:
 *
 *  1. La detección real del tipo de archivo. Si alguna vez se sustituye por la
 *     extensión, un archivo renombrado pasaría el control.
 *  2. El candado del borrador. Si un estado nuevo del ciclo de vida no entra en
 *     la lista, la imagen de un concurso sin anunciar queda pública sin que
 *     nadie se entere.
 *  3. El aislamiento por concurso. Una clave de storage que no pertenezca al
 *     concurso no puede servirse jamás.
 */

import {
  contestMediaIsPubliclyVisible,
  contestMediaStorageKey,
  contestMediaUrl,
  isContestMediaKind,
  isSixteenByNine,
  pickContestMedia,
  sniffImageType,
  storageKeyBelongsToContest,
  validateAltText,
  validateImageDimensions,
  validateUploadBytes,
  CONTEST_MEDIA_SPECS,
  CONTEST_MEDIA_KINDS,
  type ResolvedContestMedia,
} from "./index";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

/* ---------- 1) Tipo real por firma binaria, no por extensión ---------- */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

ok(sniffImageType(JPEG)?.mime === "image/jpeg", "una firma JPEG se identifica como JPEG");
ok(sniffImageType(PNG)?.mime === "image/png", "una firma PNG se identifica como PNG");
ok(sniffImageType(WEBP)?.mime === "image/webp", "una firma WebP se identifica como WebP");

/**
 * El caso que motiva todo esto: un SVG renombrado a .jpg. La extensión miente,
 * los bytes no.
 */
const SVG_DISFRAZADO = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
ok(sniffImageType(SVG_DISFRAZADO) === null, "un SVG renombrado a .jpg NO se acepta como imagen");

const HTML_DISFRAZADO = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
ok(sniffImageType(HTML_DISFRAZADO) === null, "un HTML renombrado a .png NO se acepta como imagen");

ok(sniffImageType(new Uint8Array([1, 2, 3])) === null, "un archivo demasiado corto se rechaza");

/* ---------- 2) Validación de la subida ---------- */

const vacio = validateUploadBytes({ bytes: new Uint8Array(0) });
ok(!vacio.ok && vacio.error.code === "empty_file", "un archivo vacío se rechaza");

const disfrazado = validateUploadBytes({ bytes: SVG_DISFRAZADO, declaredMime: "image/jpeg" });
ok(
  !disfrazado.ok && disfrazado.error.code === "unsupported_type",
  "declarar image/jpeg no alcanza si el contenido no lo es",
);

const jpegOk = validateUploadBytes({ bytes: JPEG, declaredMime: "image/jpeg" });
ok(jpegOk.ok, "un JPEG real con su tipo declarado pasa");

const grande = validateUploadBytes({ bytes: new Uint8Array(20 * 1024 * 1024) });
ok(!grande.ok && grande.error.code === "too_large", "un archivo de 20 MB se rechaza por peso");

/* ---------- 3) Dimensiones ---------- */

ok(validateImageDimensions({ width: 1920, height: 1080 }).ok, "1920×1080 se acepta");

const chica = validateImageDimensions({ width: 640, height: 360 });
ok(!chica.ok && chica.error.code === "too_small", "640×360 se rechaza por chica");

const gigante = validateImageDimensions({ width: 20000, height: 11250 });
ok(
  !gigante.ok && gigante.error.code === "too_large_dimensions",
  "20000 px de lado se rechaza antes de decodificar",
);

const rota = validateImageDimensions({ width: 0, height: 0 });
ok(!rota.ok && rota.error.code === "corrupt_image", "dimensiones en cero se tratan como imagen rota");

/* ---------- 4) Proporción 16:9 ---------- */

ok(isSixteenByNine(1920, 1080), "1920×1080 es 16:9");
ok(isSixteenByNine(1280, 720), "1280×720 es 16:9");
ok(!isSixteenByNine(1080, 1080), "un cuadrado no es 16:9");
ok(!isSixteenByNine(1080, 1920), "un vertical no es 16:9");

/**
 * Las tres salidas son 16:9. Si alguien agrega un tipo con otra proporción,
 * esto lo detiene: la promesa "conserva 16:9" dejaría de ser cierta.
 */
for (const kind of CONTEST_MEDIA_KINDS) {
  const spec = CONTEST_MEDIA_SPECS[kind];
  ok(
    isSixteenByNine(spec.width, spec.height),
    `la salida de ${kind} (${spec.width}×${spec.height}) conserva 16:9`,
  );
}

/* ---------- 5) Texto alternativo obligatorio ---------- */

ok(!validateAltText("").ok, "un alt vacío se rechaza");
ok(!validateAltText("  ").ok, "un alt con sólo espacios se rechaza");
ok(!validateAltText("ab").ok, "un alt de dos letras se rechaza");

const alt = validateAltText("  Afiche   del concurso  ");
ok(alt.ok && alt.value === "Afiche del concurso", "el alt se normaliza (espacios colapsados)");

/* ---------- 6) El candado del borrador ---------- */

ok(!contestMediaIsPubliclyVisible("DRAFT"), "DRAFT no expone la imagen públicamente");
ok(
  !contestMediaIsPubliclyVisible("SETUP_IN_PROGRESS"),
  "SETUP_IN_PROGRESS no expone la imagen públicamente",
);
ok(
  !contestMediaIsPubliclyVisible("READY_TO_PUBLISH"),
  "READY_TO_PUBLISH tampoco: revisado no es lo mismo que anunciado",
);
ok(!contestMediaIsPubliclyVisible("draft"), "el candado no depende de mayúsculas o minúsculas");
ok(contestMediaIsPubliclyVisible("PUBLISHED"), "PUBLISHED sí expone la imagen");
ok(contestMediaIsPubliclyVisible("ACTIVE"), "ACTIVE sí expone la imagen");
ok(contestMediaIsPubliclyVisible("UPCOMING"), "UPCOMING sí: la convocatoria ya se anunció");

/* ---------- 7) Aislamiento por concurso ---------- */

const key = contestMediaStorageKey({
  contestId: "contest-aaa",
  kind: "BANNER",
  assetId: "asset-1",
  extension: "jpg",
});
ok(key === "fotorank/contests/contest-aaa/media/banner/asset-1.jpg", "la clave se arma como se espera");
ok(storageKeyBelongsToContest(key, "contest-aaa"), "la clave pertenece a su concurso");
ok(
  !storageKeyBelongsToContest(key, "contest-bbb"),
  "la clave de un concurso NO se acepta para otro concurso",
);
ok(
  !storageKeyBelongsToContest("fotorank/contests/contest-aaa/media/../../otro.jpg", "contest-aaa"),
  "una clave con .. se rechaza aunque empiece con el prefijo correcto",
);

/* ---------- 8) La URL cambia al reemplazar la imagen ---------- */

/**
 * Si la URL dependiera sólo del tipo, WhatsApp y Facebook seguirían mostrando
 * la imagen vieja durante días después de un reemplazo.
 */
ok(
  contestMediaUrl("c1", "asset-1") !== contestMediaUrl("c1", "asset-2"),
  "reemplazar la imagen cambia la URL (evita cachés pegadas)",
);

/* ---------- 9) Respaldo entre tipos ---------- */

const soloBanner: Partial<Record<string, ResolvedContestMedia>> = {
  BANNER: {
    kind: "BANNER",
    url: "/x",
    alt: "a",
    width: 1920,
    height: 1080,
    focalPointX: 50,
    focalPointY: 50,
  },
};
ok(
  pickContestMedia(soloBanner as never, "SOCIAL")?.kind === "BANNER",
  "sin imagen de compartir se usa el banner en lugar de no mostrar nada",
);
ok(
  pickContestMedia(soloBanner as never, "CARD")?.kind === "BANNER",
  "sin imagen de tarjeta se usa el banner",
);
ok(pickContestMedia({}, "BANNER") === null, "sin ninguna imagen devuelve null, no una URL inventada");

/* ---------- 10) Guardas de tipo ---------- */

ok(isContestMediaKind("BANNER"), "BANNER es un tipo válido");
ok(!isContestMediaKind("banner"), "el tipo distingue mayúsculas: no se acepta 'banner'");
ok(!isContestMediaKind("HERO"), "un tipo inventado se rechaza");
ok(!isContestMediaKind(null), "null no es un tipo válido");

console.log("FINAL: PASS");
