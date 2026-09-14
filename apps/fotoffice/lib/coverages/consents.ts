import { createHash } from "node:crypto";

/**
 * Los permisos que se piden en el formulario público.
 *
 * Uno por fila y no un "acepto todo": autorizar la cobertura, avisar que va a haber menores y
 * permitir que la organización muestre las fotos son cosas distintas, con consecuencias
 * distintas. Cuando alguien reclame —y alguna vez va a pasar— hay que poder decir cuál dio y
 * qué texto exacto leyó.
 */
export const CONSENT_KINDS = [
  "AUTORIZA_COBERTURA",
  "MENORES_PRESENTES",
  "CONSENTIMIENTOS_IMAGEN",
  "RESTRICCIONES_PUBLICACION",
  "USO_INSTITUCIONAL",
  "TERMINOS",
  "PRIVACIDAD",
] as const;

export type ConsentKind = (typeof CONSENT_KINDS)[number];

/**
 * Sin estos cuatro no se puede empezar.
 *
 * Los otros tres son declaraciones, no permisos: que haya menores o que existan
 * consentimientos de imagen son datos que cambian cómo se hace la cobertura, y que la
 * organización deje mostrar las fotos es una gentileza, no un requisito.
 */
export const REQUIRED_CONSENTS: readonly ConsentKind[] = [
  "AUTORIZA_COBERTURA",
  "RESTRICCIONES_PUBLICACION",
  "TERMINOS",
  "PRIVACIDAD",
];

export const CONSENT_LABELS: Record<ConsentKind, string> = {
  AUTORIZA_COBERTURA: "Puedo autorizar esta cobertura en nombre de la organización",
  MENORES_PRESENTES: "En la actividad va a haber menores de edad",
  CONSENTIMIENTOS_IMAGEN: "Tenemos los consentimientos de imagen de quienes participan",
  RESTRICCIONES_PUBLICACION: "Entiendo que puede haber restricciones de publicación",
  USO_INSTITUCIONAL: "Autorizo a mostrar imágenes de este trabajo",
  TERMINOS: "Acepto las condiciones del servicio",
  PRIVACIDAD: "Leí la política de privacidad",
};

/**
 * El texto exacto de cada permiso, por versión.
 *
 * Versionado desde el día uno: el día que se reescriba un texto, los consentimientos ya
 * firmados tienen que seguir apuntando al que se leyó, no al nuevo.
 */
const TEXTOS_V1: Record<ConsentKind, string> = {
  AUTORIZA_COBERTURA:
    "Declaro que represento a la organización solicitante y que puedo autorizar esta cobertura fotográfica.",
  MENORES_PRESENTES:
    "Informo que en la actividad van a estar presentes personas menores de edad.",
  CONSENTIMIENTOS_IMAGEN:
    "Declaro que la organización cuenta con los consentimientos de uso de imagen de las personas que participan.",
  RESTRICCIONES_PUBLICACION:
    "Entiendo que puede haber personas o situaciones que no se pueden publicar, y me comprometo a informarlas antes de la cobertura.",
  USO_INSTITUCIONAL:
    "Autorizo a la organización que realiza la cobertura a mostrar imágenes de este trabajo en sus canales de difusión.",
  TERMINOS: "Acepto las condiciones del servicio.",
  PRIVACIDAD: "Leí y acepto la política de privacidad y el tratamiento de los datos cargados.",
};

/**
 * Los textos, agrupados por versión. Agregar `v2` es sumar una entrada acá, no tocar esta
 * función.
 */
const TEXTOS_POR_VERSION: Record<string, Record<ConsentKind, string>> = {
  v1: TEXTOS_V1,
};

/** La versión que se muestra hoy en el formulario. */
export const CONSENT_TEXT_VERSION_VIGENTE = "v1";

/**
 * Los textos de una versión, junto con la versión que realmente se está sirviendo.
 *
 * Si la versión pedida existe, se devuelve ella y su propio número. Si no existe —por ejemplo,
 * alguien actualizó la versión vigente en otro lado sin sumarla acá—, se degrada a la vigente
 * **y se devuelve su número**, nunca el que se pidió. Así `parseConsents` nunca puede guardar un
 * `textVersion` que no sea el de los textos que realmente calculó el `textHash`: es
 * estructuralmente imposible que ese campo mienta sobre qué texto exacto leyó la persona. Una
 * versión desconocida se ve en el dato (queda la vigente), en vez de mentir con la que se pidió.
 */
export function consentTexts(version: string): {
  version: string;
  texts: Record<ConsentKind, string>;
} {
  const textos = TEXTOS_POR_VERSION[version];
  if (textos) return { version, texts: textos };
  return { version: CONSENT_TEXT_VERSION_VIGENTE, texts: TEXTOS_POR_VERSION[CONSENT_TEXT_VERSION_VIGENTE] };
}

export function hashConsentText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export type ParsedConsent = {
  kind: ConsentKind;
  granted: boolean;
  textVersion: string;
  textHash: string;
};

export type ConsentParseResult =
  | { ok: true; data: ParsedConsent[] }
  | { ok: false; error: string };

/**
 * Lee los tildes del formulario y arma una fila por CADA permiso del catálogo.
 *
 * También por los que no se tildaron. Guardar el "no" importa tanto como el "sí": es la
 * diferencia entre «dijo que no» y «nunca se le preguntó», y a los seis meses nadie se acuerda
 * de cuál de las dos fue.
 */
export function parseConsents(
  form: Record<string, string>,
  version: string,
): ConsentParseResult {
  // `servida` es la versión de la que salió `texts` de verdad —puede no ser la pedida, si la
  // pedida no existe—. Cada fila guarda esa, nunca el parámetro `version`: así `textVersion` y
  // `textHash` describen siempre el mismo texto.
  const { version: servida, texts: textos } = consentTexts(version);
  const data: ParsedConsent[] = [];

  for (const kind of CONSENT_KINDS) {
    const granted = form[`consent_${kind}`] === "on";
    if (!granted && REQUIRED_CONSENTS.includes(kind)) {
      return { ok: false, error: `Falta confirmar: ${CONSENT_LABELS[kind]}.` };
    }
    data.push({
      kind,
      granted,
      textVersion: servida,
      textHash: hashConsentText(textos[kind]),
    });
  }

  return { ok: true, data };
}
