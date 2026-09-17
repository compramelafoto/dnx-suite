/**
 * Parseo y validación del formulario público.
 *
 * Todo se valida en el servidor. El `required` del HTML es una comodidad para quien completa,
 * no un control: el navegador puede mandar lo que quiera.
 *
 * **Qué se exige y qué se ignora sale de la configuración del workspace**, no de una lista
 * escrita acá: la misma configuración que dibuja el formulario (`./request-fields.ts`) decide
 * qué campos son obligatorios y cuáles ni se miran. Esconder un campo en la pantalla no es el
 * control: un campo oculto que igual llega en el `FormData` se descarta acá, así que nunca se
 * guarda un dato que la institución decidió no pedir.
 *
 * Función pura, sin Prisma: así el caso que importa —qué pasa con una fecha dada vuelta o un
 * enlace `javascript:`— se prueba sin levantar nada.
 */

import { encodeGeohash, validateCoordinates } from "@repo/geo";
import {
  DEFAULT_REQUEST_FORM_CONFIG,
  formatChoiceValue,
  REQUEST_FIELDS,
  requestFieldOptions,
  requestFieldOtherInputName,
  resolveRequestFieldStates,
  type RequestFieldDef,
  type RequestFormFieldConfig,
} from "./request-fields";

export type ParsedRequest = {
  orgName: string;
  orgKind: string | null;
  orgTaxId: string | null;
  orgWebsite: string | null;
  /**
   * Cadena vacía si la institución no pregunta con quién hablar. No es `null` para no obligar a
   * cada consumidor a tratar el caso: los que lo necesitan (el saludo del correo, la ficha del
   * padrón) ya tienen a qué caer, que es el nombre de la organización.
   */
  contactName: string;
  contactRole: string | null;
  contactEmail: string;
  contactPhone: string | null;
  eventTitle: string;
  eventDescription: string | null;
  startsAt: Date;
  endsAt: Date;
  /** Lo que alimenta la regla del refuerzo. Se calcula acá para no repetirlo en cada pantalla. */
  durationMinutes: number;
  addressLine: string | null;
  city: string | null;
  /**
   * El punto que la organización confirmó en el mapa, si lo confirmó.
   *
   * **Siempre puede faltar, y el pedido se manda igual.** Una dirección bien escrita ya alcanza
   * para tomar el pedido; el punto es lo que después saca la duda de por dónde se entra. Si
   * Nominatim no encuentra el lugar —pasa en pueblos chicos— o la persona no quiso abrir el
   * mapa, acá queda `null` y no pasa nada.
   *
   * `geohash` no llega del formulario: se calcula acá con `@repo/geo` a partir del punto. Que lo
   * mande el navegador sería dejar que un dato derivado llegue de afuera, donde puede no
   * corresponder a las coordenadas que lo acompañan.
   */
  latitude: number | null;
  longitude: number | null;
  geohash: string | null;
  activityKind: string | null;
  expectedAttendees: number | null;
  /**
   * Los tres campos de elección. Se guardan con el valor del catálogo —nunca con lo que
   * escribió el navegador— y, cuando la respuesta es "Otros", con el texto libre detrás:
   * `OTROS: con carpa`. La forma está explicada en `formatChoiceValue`.
   */
  venueKind: string | null;
  otherCoverage: string | null;
  showcaseScope: string | null;
  onSiteContactName: string | null;
  onSitePhone: string | null;
  mediaKinds: string;
  coverageKind: string | null;
  purpose: string | null;
  keyMoments: string | null;
  requestedPhotographers: number | null;
  equipmentNotes: string | null;
  needsLighting: boolean;
  expectedDeliveryAt: Date | null;
  deliveryChannel: string | null;
  notes: string | null;
  documentationLinks: string[];
};

export type RequestParseResult =
  | { ok: true; data: ParsedRequest }
  | { ok: false; error: string };

/** Deliberadamente más estricta que la especificación: alcanza con aceptar lo que se escribe. */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(?:\.[^\s@,;.]+)+$/;

function texto(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function entero(v: string | undefined): { ok: true; value: number | null } | { ok: false } {
  const t = v?.trim();
  if (!t) return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  if (n < 1) return { ok: false };
  return { ok: true, value: n };
}

function fecha(v: string | undefined): Date | null {
  const t = v?.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Solo `http` y `https`.
 *
 * Un `javascript:` guardado y después pintado como enlace en el panel de la coordinación sería
 * un agujero abierto por un formulario público. Lo que no pasa el filtro se descarta en
 * silencio: es documentación de apoyo, no vale frenar un pedido por un enlace mal pegado.
 */
/**
 * Una respuesta de un campo de elección, validada contra la lista de opciones.
 *
 * **Lo que no está en la lista se rechaza; nunca se guarda crudo.** Los botones del formulario
 * son una comodidad para quien completa, no el control: el `FormData` lo arma el navegador y
 * puede decir cualquier cosa. Sin esta comprobación, la columna se llenaría de valores que
 * ninguna pantalla sabe leer y ningún recuento sabe contar.
 *
 * El texto libre de "Otros" sí viaja como lo escribió la persona —es su aclaración— pero sólo
 * detrás de una opción válida y recortado a un renglón (ver `formatChoiceValue`).
 */
function eleccion(
  field: RequestFieldDef,
  raw: string | undefined,
  otroRaw: string | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const elegido = raw?.trim();
  if (!elegido) return { ok: true, value: null };
  const permitidas = requestFieldOptions(field).map((o) => o.value);
  if (!permitidas.includes(elegido)) {
    return { ok: false, error: `Elegí una de las respuestas de «${field.label}».` };
  }
  return { ok: true, value: formatChoiceValue(elegido, otroRaw ?? null) };
}

/**
 * El punto del mapa, validado por el DNX GEO ENGINE.
 *
 * `validateCoordinates` es la misma función que usan InfoSpot y el proxy de geocodificación:
 * números finitos, en rango, y nada de `0,0` —que casi nunca es un lugar en el golfo de Guinea y
 * casi siempre es un campo vacío que se convirtió en cero por el camino—.
 *
 * **Lo que no pasa la validación se descarta en silencio, sin frenar el envío.** Es el mismo
 * criterio que los enlaces de documentación: el punto es un agregado, y perder una cobertura
 * porque un `hidden` llegó raro sería cambiar un dato opcional por el pedido entero.
 *
 * El geohash sale de acá y no del formulario: es un dato derivado, y calcularlo en el servidor
 * garantiza que siempre corresponda a las coordenadas que lo acompañan.
 */
function punto(
  latRaw: string | undefined,
  lonRaw: string | undefined,
): { latitude: number | null; longitude: number | null; geohash: string | null } {
  const vacio = { latitude: null, longitude: null, geohash: null };
  if (!latRaw?.trim() || !lonRaw?.trim()) return vacio;

  const v = validateCoordinates(latRaw, lonRaw);
  if (!v.ok) return vacio;

  const { latitude, longitude } = v.coordinates;
  return { latitude, longitude, geohash: encodeGeohash(latitude, longitude) };
}

function enlaces(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^https?:\/\//i.test(s));
}

export function parseCoverageRequest(
  form: Record<string, string>,
  config: RequestFormFieldConfig = DEFAULT_REQUEST_FORM_CONFIG,
): RequestParseResult {
  const estados = resolveRequestFieldStates(config);

  /**
   * Lo que llegó para un campo, o nada si la institución no lo pregunta.
   *
   * Acá se cumple el cuidado que da sentido a todo esto: un campo oculto que igual viene en el
   * `FormData` —una pestaña vieja, un `curl`, un formulario copiado— se descarta antes de
   * mirarlo, así que no se valida ni se guarda. Las claves que no están en el catálogo (las que
   * sólo carga la coordinación desde el panel, como `mediaKinds`) pasan derecho: no son
   * configurables porque el formulario público nunca las preguntó.
   */
  const crudo = (clave: string): string | undefined =>
    estados[clave] === "OCULTO" ? undefined : form[clave];

  const orgName = texto(crudo("orgName"));
  if (!orgName) return { ok: false, error: "Escribí el nombre de la organización." };

  const contactEmail = texto(crudo("contactEmail"))?.toLowerCase() ?? null;
  if (!contactEmail) return { ok: false, error: "Escribí un correo de contacto." };
  if (!EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "Ese correo no parece válido. Revisalo, por ahí quedó un error." };
  }

  const eventTitle = texto(crudo("eventTitle"));
  if (!eventTitle) return { ok: false, error: "Contanos cómo se llama la actividad." };

  const startsAt = fecha(crudo("startsAt"));
  const endsAt = fecha(crudo("endsAt"));
  if (!startsAt) return { ok: false, error: "Falta cuándo empieza la actividad." };
  if (!endsAt) return { ok: false, error: "Falta cuándo termina la actividad." };
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "La actividad termina antes de empezar. Revisá los horarios." };
  }

  const fotografos = entero(crudo("requestedPhotographers"));
  if (!fotografos.ok) {
    return { ok: false, error: "La cantidad de fotógrafos tiene que ser un número mayor a cero." };
  }

  const asistentes = entero(crudo("expectedAttendees"));
  if (!asistentes.ok) {
    return { ok: false, error: "La cantidad de asistentes tiene que ser un número." };
  }

  const expectedDeliveryAt = fecha(crudo("expectedDeliveryAt"));
  const documentationLinks = enlaces(crudo("documentationLinks"));

  /**
   * El punto es del campo de dirección, no un campo aparte.
   *
   * El catálogo no lo tiene como una pregunta propia —nadie escribe una latitud— así que su
   * estado es el de `addressLine`: con la dirección oculta no se dibuja el mapa, y por lo tanto
   * tampoco se guarda un punto que la institución decidió no preguntar. Es el mismo cuidado que
   * hace `crudo` con cualquier otro campo apagado, escrito a mano porque `latitude` y
   * `longitude` no son claves del catálogo.
   */
  const lugar =
    estados.addressLine === "OCULTO"
      ? { latitude: null, longitude: null, geohash: null }
      : punto(form.latitude, form.longitude);

  // Los campos de elección, todos juntos y con la misma regla: la del catálogo. Un campo de
  // elección oculto no llega a `eleccion` —`crudo` ya lo descartó— así que tampoco se valida ni
  // se guarda, igual que cualquier otro campo apagado.
  const elecciones: Record<string, string | null> = {};
  for (const campo of REQUEST_FIELDS) {
    if (campo.input !== "choice") continue;
    const r = eleccion(
      campo,
      crudo(campo.key),
      crudo(campo.key) === undefined ? undefined : form[requestFieldOtherInputName(campo.key)],
    );
    if (!r.ok) return { ok: false, error: r.error };
    elecciones[campo.key] = r.value;
  }

  const data: ParsedRequest = {
    orgName,
    orgKind: texto(crudo("orgKind")),
    orgTaxId: texto(crudo("orgTaxId")),
    orgWebsite: texto(crudo("orgWebsite")),
    contactName: texto(crudo("contactName")) ?? "",
    contactRole: texto(crudo("contactRole")),
    contactEmail,
    contactPhone: texto(crudo("contactPhone")),
    eventTitle,
    eventDescription: texto(crudo("eventDescription")),
    startsAt,
    endsAt,
    durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
    addressLine: texto(crudo("addressLine")),
    city: texto(crudo("city")),
    latitude: lugar.latitude,
    longitude: lugar.longitude,
    geohash: lugar.geohash,
    activityKind: texto(form.activityKind),
    expectedAttendees: asistentes.value,
    venueKind: elecciones.venueKind ?? null,
    otherCoverage: elecciones.otherCoverage ?? null,
    showcaseScope: elecciones.showcaseScope ?? null,
    onSiteContactName: texto(crudo("onSiteContactName")),
    onSitePhone: texto(crudo("onSitePhone")),
    mediaKinds: texto(form.mediaKinds) ?? "FOTO",
    coverageKind: texto(form.coverageKind),
    purpose: texto(crudo("purpose")),
    keyMoments: texto(crudo("keyMoments")),
    requestedPhotographers: fotografos.value,
    equipmentNotes: texto(form.equipmentNotes),
    needsLighting: form.needsLighting === "on",
    expectedDeliveryAt,
    deliveryChannel: texto(form.deliveryChannel),
    notes: texto(crudo("notes")),
    documentationLinks,
  };

  const faltante = campoObligatorioSinCompletar(data, estados, form);
  if (faltante) return { ok: false, error: faltante };

  return { ok: true, data };
}

/**
 * El primer campo obligatorio que quedó sin completar, dicho con la etiqueta que la persona vio.
 *
 * Los cinco fijos ya se validaron arriba, con su mensaje propio: son condiciones del sistema y
 * merecen una explicación mejor que "falta completar". Este recorrido cubre a los otros
 * dieciocho, que son obligatorios sólo porque esta institución lo decidió.
 *
 * Se mira el valor **ya resuelto**, no el texto crudo: así una fecha ilegible o un enlace que no
 * pasó el filtro cuentan como campo sin completar en vez de guardarse en silencio como vacío.
 */
function campoObligatorioSinCompletar(
  data: ParsedRequest,
  estados: Record<string, string>,
  form: Record<string, string>,
): string | null {
  const valores = data as unknown as Record<string, unknown>;
  for (const campo of REQUEST_FIELDS) {
    if (campo.fixed || estados[campo.key] !== "OBLIGATORIO") continue;
    const valor = valores[campo.key];
    const vacio =
      valor === null ||
      valor === undefined ||
      valor === "" ||
      (Array.isArray(valor) && valor.length === 0);
    if (!vacio) continue;
    // Escribieron algo y no quedó nada: el problema no es que falte, es que no sirve.
    if (campo.key === "documentationLinks" && (form.documentationLinks ?? "").trim()) {
      return "Los enlaces tienen que empezar con http:// o https://.";
    }
    return `Falta completar «${campo.label}».`;
  }
  return null;
}
