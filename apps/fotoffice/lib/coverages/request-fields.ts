/**
 * Qué le pregunta cada institución a quien pide una cobertura.
 *
 * El formulario público es la única pantalla del módulo que ve gente de afuera, y no todas las
 * organizaciones necesitan las mismas 26 preguntas: una pide el CUIT porque después factura,
 * otra no sabe qué hacer con ese dato y sólo consigue que la ONG abandone a mitad de camino.
 *
 * Cada campo está en uno de tres estados: oculto, opcional u obligatorio. El estado sale de dos
 * listas guardadas en `CoverageSettings` (`requestFormHidden` y `requestFormRequired`) y de este
 * catálogo. Módulo puro a propósito: lo leen el servidor (para validar), la pantalla pública
 * (para dibujar) y la de configuración (para ofrecer los estados), y así las tres dicen lo
 * mismo sin copiarse la lista de campos.
 *
 * **Cinco campos son fijos y no se pueden tocar.** No es una restricción de diseño sino una del
 * sistema: sin ellos no hay solicitud que guardar ni cobertura que generar. Los fijos ignoran
 * las dos listas, incluso si alguien escribe sus claves ahí a mano en la base.
 */

export const REQUEST_FIELD_STATES = ["OCULTO", "OPCIONAL", "OBLIGATORIO"] as const;
export type RequestFieldState = (typeof REQUEST_FIELD_STATES)[number];

export const REQUEST_FIELD_STATE_LABELS: Record<RequestFieldState, string> = {
  OCULTO: "No lo preguntamos",
  OPCIONAL: "Opcional",
  OBLIGATORIO: "Obligatorio",
};

/** Las secciones del formulario. El orden es el orden en que se leen. */
export const REQUEST_FIELD_SECTIONS = [
  {
    key: "ORGANIZACION",
    legend: "Quiénes son",
    hint: "Para saber con quién hablamos y cómo contestarte.",
  },
  {
    key: "ACTIVIDAD",
    legend: "Qué actividad es",
    hint: "Lo que necesitamos para ver si llegamos con la fecha.",
  },
  {
    key: "NECESIDAD",
    legend: "Qué necesitan",
    hint: "Lo que nos ayuda a mandar a la persona indicada.",
  },
] as const;

export type RequestFieldSectionKey = (typeof REQUEST_FIELD_SECTIONS)[number]["key"];

/** Cómo se dibuja el campo. Es la forma del control, no el tipo del dato guardado. */
export type RequestFieldInput =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "datetime-local"
  | "textarea"
  | "choice";

/** Una respuesta posible de un campo de elección. El `value` es lo que se guarda. */
export type RequestFieldOption = { value: string; label: string };

/**
 * La respuesta "Otros" de un campo de elección.
 *
 * No se escribe en la lista de opciones de cada campo: se agrega sola cuando el campo declara
 * `allowsOther`, así ningún campo puede tener dos "Otros" ni escribirlo distinto.
 */
export const OTHER_OPTION_VALUE = "OTROS";
export const OTHER_OPTION_LABEL = "Otros";

/**
 * Cómo conviven el valor elegido y el texto libre de "Otros" en una sola columna.
 *
 * Se guarda `OTROS: lo que haya escrito`. El valor del catálogo va siempre adelante, así una
 * consulta que cuente respuestas sigue leyendo un valor conocido y el texto de la persona nunca
 * queda guardado solo, sin la opción que eligió. Ninguna opción puede tener dos puntos en su
 * `value` —hay un test que lo verifica— así que el corte nunca es ambiguo.
 */
const SEPARADOR_OTROS = ": ";

/** Cuánto texto libre se guarda de un "Otros". Es un renglón, no una carta. */
export const OTHER_TEXT_MAX_LENGTH = 300;

export type RequestFieldDef = {
  key: string;
  label: string;
  section: RequestFieldSectionKey;
  input: RequestFieldInput;
  /** Un campo fijo ignora las dos listas: siempre se pregunta y siempre es obligatorio. */
  fixed: boolean;
  /** Por qué es fijo. Se muestra en la pantalla de configuración, en vez de esconder el campo. */
  fixedReason?: string;
  /** Por qué se pregunta, en las palabras de quien lo lee. Va debajo de la etiqueta. */
  hint?: string;
  /** Las respuestas posibles. Sólo en los campos de elección. */
  options?: readonly RequestFieldOption[];
  /** Si además de las opciones se ofrece "Otros" con un texto libre. */
  allowsOther?: boolean;
};

/**
 * Los 26 campos del formulario público, en el orden en que aparecen.
 *
 * Las claves son las mismas que lee `parseCoverageRequest` y las mismas que viajan como `name`
 * en el formulario: son el contrato entre las tres partes. Un campo nuevo se agrega acá y
 * aparece solo en las tres pantallas; una clave que no coincida no da error, simplemente deja
 * de configurarse.
 *
 * Las etiquetas están escritas como las diría quien recibe el pedido y no como las nombra la
 * base: "Lugar del evento (nombre del lugar y dirección exacta)" consigue una dirección que
 * sirve para llegar; "Dirección" consigue "Rosario".
 *
 * **El día de la semana no se pregunta**: sale de la fecha. En un formulario de papel —o en uno
 * de Google, que tampoco lo calcula— tiene sentido pedirlo; acá sería pedir dos veces el mismo
 * dato y arriesgarse a que no coincidan.
 */
export const REQUEST_FIELDS: readonly RequestFieldDef[] = [
  {
    key: "orgName",
    label: "Nombre de la organización",
    section: "ORGANIZACION",
    input: "text",
    fixed: true,
    fixedReason: "Sin el nombre no hay a quién asociar el pedido.",
  },
  { key: "orgKind", label: "Qué tipo de organización es", section: "ORGANIZACION", input: "text", fixed: false },
  { key: "orgTaxId", label: "CUIT, si tienen", section: "ORGANIZACION", input: "text", fixed: false },
  { key: "orgWebsite", label: "Sitio o redes", section: "ORGANIZACION", input: "text", fixed: false },
  { key: "contactName", label: "Nombre del contacto", section: "ORGANIZACION", input: "text", fixed: false },
  { key: "contactRole", label: "Qué rol tiene", section: "ORGANIZACION", input: "text", fixed: false },
  {
    key: "contactEmail",
    label: "Correo electrónico",
    section: "ORGANIZACION",
    input: "email",
    fixed: true,
    fixedReason: "Sin correo no hay enlace de seguimiento ni forma de contestar.",
  },
  {
    key: "contactPhone",
    label: "WhatsApp o teléfono de contacto",
    section: "ORGANIZACION",
    input: "tel",
    fixed: false,
  },
  {
    key: "eventTitle",
    label: "Nombre del evento o actividad",
    section: "ACTIVIDAD",
    input: "text",
    fixed: true,
    fixedReason: "La cobertura se genera con este dato.",
  },
  {
    key: "eventDescription",
    label: "Descripción del evento o actividad",
    section: "ACTIVIDAD",
    input: "textarea",
    fixed: false,
    hint: "Una descripción detallada nos ayuda a cubrir mejor el evento.",
  },
  {
    key: "startsAt",
    label: "Fecha y horario exacto de inicio",
    section: "ACTIVIDAD",
    input: "datetime-local",
    fixed: true,
    fixedReason: "La cobertura se genera con este dato.",
  },
  {
    key: "endsAt",
    label: "Fecha y horario exacto de finalización",
    section: "ACTIVIDAD",
    input: "datetime-local",
    fixed: true,
    fixedReason: "La cobertura se genera con este dato.",
  },
  {
    key: "addressLine",
    label: "Lugar del evento (nombre del lugar y dirección exacta)",
    section: "ACTIVIDAD",
    input: "text",
    fixed: false,
  },
  { key: "city", label: "Localidad", section: "ACTIVIDAD", input: "text", fixed: false },
  {
    key: "venueKind",
    label: "¿El evento será en un lugar cerrado o al aire libre?",
    section: "ACTIVIDAD",
    input: "choice",
    fixed: false,
    hint: "Cambia el equipo que lleva quien cubre.",
    options: [
      { value: "INTERIOR", label: "Lugar cerrado" },
      { value: "EXTERIOR", label: "Al aire libre" },
      { value: "AMBOS", label: "Mixto" },
    ],
    allowsOther: true,
  },
  {
    key: "expectedAttendees",
    label: "Cantidad de personas estimadas en el evento",
    section: "ACTIVIDAD",
    input: "number",
    fixed: false,
  },
  { key: "onSiteContactName", label: "Quién va a estar ese día", section: "ACTIVIDAD", input: "text", fixed: false },
  { key: "onSitePhone", label: "Su teléfono", section: "ACTIVIDAD", input: "tel", fixed: false },
  { key: "purpose", label: "Para qué van a usar las fotos", section: "NECESIDAD", input: "textarea", fixed: false },
  {
    key: "keyMoments",
    label: "En caso que la duración sea mayor a 2 o 3hs, indicanos qué momento es prioritario",
    section: "NECESIDAD",
    input: "textarea",
    fixed: false,
  },
  {
    key: "requestedPhotographers",
    label: "Cuántos fotógrafos creen que hacen falta",
    section: "NECESIDAD",
    input: "number",
    fixed: false,
  },
  { key: "expectedDeliveryAt", label: "Para cuándo las necesitan", section: "NECESIDAD", input: "date", fixed: false },
  {
    key: "documentationLinks",
    label: "Enlaces que nos ayuden a conocerlos",
    section: "NECESIDAD",
    input: "textarea",
    fixed: false,
  },
  {
    key: "otherCoverage",
    label: "¿Va a haber algún otro fotógrafo o equipo de foto/video cubriendo el evento?",
    section: "NECESIDAD",
    input: "choice",
    fixed: false,
    // La ayuda no es decorativa: es lo único que hace que la respuesta sea sincera. Sin ella,
    // contestar "sí, ya hay otro fotógrafo" parece inofensivo, y es justo la respuesta que
    // puede dejar el pedido sin cobertura. Quien contesta tiene derecho a saber qué se hace
    // con lo que contesta.
    hint:
      "Como somos pocos, saber esto nos ayuda a organizarnos mejor: si ya hay otra cobertura, " +
      "puede que prioricemos otros pedidos.",
    options: [
      { value: "SIN_OTRA_COBERTURA", label: "Confirmo que NO habrá otros fotógrafos ni equipo de foto/video" },
      { value: "NO_LO_SE", label: "No lo sé / no puedo confirmarlo en este momento" },
      {
        value: "HAY_OTRA_COBERTURA",
        label: "Sí. Habrá otros fotógrafos o equipo de foto/video (contratados o voluntarios)",
      },
    ],
    allowsOther: true,
  },
  {
    key: "showcaseScope",
    label: "¿Nos autorizan a compartir material del evento?",
    section: "NECESIDAD",
    input: "choice",
    fixed: false,
    hint:
      "En ciertas ocasiones compartimos algunas fotos de los eventos en nuestras redes para " +
      "ayudar a difundir la actividad de cada organización.",
    options: [
      { value: "TODO", label: "Sí, pueden compartir lo que quieran, nos viene bien" },
      { value: "CON_RESTRICCIONES", label: "Pueden subir fotos, pero con restricciones (aclarámelas en «Otros»)" },
      { value: "SIN_PERSONAS", label: "Pueden subir fotos que refieran al evento, pero no de personas" },
      { value: "NADA", label: "Por favor no suban ninguna foto del evento, no queremos que se conozca" },
    ],
    allowsOther: true,
  },
  { key: "notes", label: "Comentarios", section: "NECESIDAD", input: "textarea", fixed: false },
] as const;

export const FIXED_REQUEST_FIELD_KEYS: readonly string[] = REQUEST_FIELDS.filter((f) => f.fixed).map(
  (f) => f.key,
);

/** Un campo del catálogo por su clave. `null` si esa clave no existe. */
export function requestFieldByKey(key: string): RequestFieldDef | null {
  return REQUEST_FIELDS.find((f) => f.key === key) ?? null;
}

/**
 * Las opciones que se le muestran a quien completa, con "Otros" al final si el campo lo permite.
 *
 * Es la misma lista que valida el servidor: la pantalla no puede ofrecer una opción que después
 * se rechace, ni el servidor aceptar una que nadie vio.
 */
export function requestFieldOptions(field: RequestFieldDef): RequestFieldOption[] {
  const base = [...(field.options ?? [])];
  if (field.allowsOther) base.push({ value: OTHER_OPTION_VALUE, label: OTHER_OPTION_LABEL });
  return base;
}

/** El `name` del texto libre que acompaña a un "Otros". */
export function requestFieldOtherInputName(key: string): string {
  return `${key}__otro`;
}

/**
 * Cómo se guarda una elección: el valor del catálogo, y detrás el texto libre si eligió "Otros".
 *
 * El texto se recorta a un renglón —sin saltos de línea y con un tope de largo— porque es una
 * aclaración, no un campo de comentarios: para eso está el campo de comentarios.
 */
export function formatChoiceValue(value: string, otherText: string | null | undefined): string {
  if (value !== OTHER_OPTION_VALUE) return value;
  const texto = otherText?.replace(/\s+/g, " ").trim().slice(0, OTHER_TEXT_MAX_LENGTH);
  return texto ? `${OTHER_OPTION_VALUE}${SEPARADOR_OTROS}${texto}` : OTHER_OPTION_VALUE;
}

/** El valor del catálogo de una elección ya guardada, sin el texto libre. */
export function choiceOptionValue(stored: string | null | undefined): string | null {
  const crudo = stored?.trim();
  if (!crudo) return null;
  const corte = crudo.indexOf(":");
  return (corte === -1 ? crudo : crudo.slice(0, corte)).trim() || null;
}

/** El texto libre de una elección guardada como "Otros". `null` si no escribió nada. */
export function choiceOtherText(stored: string | null | undefined): string | null {
  const crudo = stored?.trim();
  if (!crudo) return null;
  const corte = crudo.indexOf(":");
  if (corte === -1) return null;
  return crudo.slice(corte + 1).trim() || null;
}

/**
 * Cómo se lee una elección guardada, para mostrarla en el panel.
 *
 * Un valor que ya no está en el catálogo —porque se sacó una opción después de que alguien la
 * eligiera— se muestra tal cual en vez de desaparecer: la respuesta que dio esa organización
 * sigue siendo su respuesta.
 */
export function choiceValueLabel(
  field: RequestFieldDef,
  stored: string | null | undefined,
): string | null {
  const valor = choiceOptionValue(stored);
  if (!valor) return null;
  const opcion = requestFieldOptions(field).find((o) => o.value === valor);
  const libre = choiceOtherText(stored);
  const etiqueta = opcion?.label ?? valor;
  return libre ? `${etiqueta}: ${libre}` : etiqueta;
}

/**
 * Lo que rige cuando una institución nunca tocó esta configuración.
 *
 * `contactName` arranca obligatorio porque **hoy lo es**: `parseCoverageRequest` corta el envío
 * sin él desde el primer día, y con ese nombre se arma la ficha del cliente en el padrón. Si
 * saliera de esta lista, todas las instituciones ya existentes verían cambiar su formulario sin
 * haber configurado nada, que es exactamente lo que esta configuración promete que no pasa.
 *
 * Va en la lista y no como un estado por omisión del catálogo para que la regla se mantenga
 * pura —el estado sale de las dos listas y nada más— y para que la institución que prefiera
 * pedirlo sin obligar pueda sacarlo. El mismo valor es el `DEFAULT` de la columna en la base,
 * así que ninguna fila necesita rellenarse a mano.
 */
export const DEFAULT_REQUEST_FORM_HIDDEN: readonly string[] = [];
export const DEFAULT_REQUEST_FORM_REQUIRED: readonly string[] = ["contactName"];

/** Las dos listas, sin arrastrar el resto de la configuración. */
export type RequestFormFieldConfig = {
  hidden: readonly string[];
  required: readonly string[];
};

export const DEFAULT_REQUEST_FORM_CONFIG: RequestFormFieldConfig = {
  hidden: DEFAULT_REQUEST_FORM_HIDDEN,
  required: DEFAULT_REQUEST_FORM_REQUIRED,
};

/**
 * El estado de un campo, a partir de las dos listas.
 *
 * Tres reglas, en este orden:
 * 1. Un campo fijo es siempre obligatorio y no mira las listas.
 * 2. Oculto gana. Un campo que quedó en las dos listas se esconde. La pantalla de configuración
 *    no debería dejar llegar a ese estado —son tres opciones excluyentes— pero la regla no puede
 *    confiar en la pantalla: las listas se pueden editar a mano en la base, y de las dos lecturas
 *    posibles, esconder es la que no le pide a nadie un dato que la institución decidió no ver.
 * 3. Lo que no está en ninguna lista es opcional.
 */
export function resolveRequestFieldState(
  field: RequestFieldDef,
  config: RequestFormFieldConfig,
): RequestFieldState {
  if (field.fixed) return "OBLIGATORIO";
  if (config.hidden.includes(field.key)) return "OCULTO";
  if (config.required.includes(field.key)) return "OBLIGATORIO";
  return "OPCIONAL";
}

/** El estado de los 26 campos, por clave. */
export function resolveRequestFieldStates(
  config: RequestFormFieldConfig,
): Record<string, RequestFieldState> {
  const out: Record<string, RequestFieldState> = {};
  for (const campo of REQUEST_FIELDS) out[campo.key] = resolveRequestFieldState(campo, config);
  return out;
}

/**
 * Si un campo del catálogo se pregunta en el formulario público.
 *
 * Lo usa la pantalla pública para decidir si el permiso de difusión se pregunta como tilde o se
 * deduce de la respuesta de `showcaseScope` (ver `lib/coverages/consents.ts`). Una clave que no
 * está en el catálogo no es visible: nunca se dibujó.
 */
export function isRequestFieldVisible(key: string, config: RequestFormFieldConfig): boolean {
  const campo = requestFieldByKey(key);
  if (!campo) return false;
  return resolveRequestFieldState(campo, config) !== "OCULTO";
}

export type ResolvedRequestField = RequestFieldDef & { state: RequestFieldState };

export type ResolvedRequestSection = {
  key: RequestFieldSectionKey;
  legend: string;
  hint: string;
  fields: ResolvedRequestField[];
};

/**
 * Las secciones tal como hay que dibujarlas: sin los campos ocultos y **sin las secciones que
 * quedaron sin ningún campo visible**.
 *
 * Una institución que apaga media sección no tiene por qué mostrarle a la ONG un título con una
 * tarjeta vacía debajo: es una pregunta sin preguntas.
 */
export function visibleRequestSections(config: RequestFormFieldConfig): ResolvedRequestSection[] {
  const estados = resolveRequestFieldStates(config);
  return REQUEST_FIELD_SECTIONS.map((seccion) => ({
    key: seccion.key,
    legend: seccion.legend,
    hint: seccion.hint,
    fields: REQUEST_FIELDS.filter(
      (campo) => campo.section === seccion.key && estados[campo.key] !== "OCULTO",
    ).map((campo) => ({ ...campo, state: estados[campo.key]! })),
  })).filter((seccion) => seccion.fields.length > 0);
}

/**
 * Las tres secciones con TODOS sus campos y su estado, para la pantalla de configuración.
 *
 * Acá no se filtra nada: quien configura tiene que ver también lo que apagó, si no no hay cómo
 * volver a encenderlo.
 */
export function allRequestSections(config: RequestFormFieldConfig): ResolvedRequestSection[] {
  const estados = resolveRequestFieldStates(config);
  return REQUEST_FIELD_SECTIONS.map((seccion) => ({
    key: seccion.key,
    legend: seccion.legend,
    hint: seccion.hint,
    fields: REQUEST_FIELDS.filter((campo) => campo.section === seccion.key).map((campo) => ({
      ...campo,
      state: estados[campo.key]!,
    })),
  }));
}

/** El `name` del control de un campo en la pantalla de configuración. */
export function requestFieldStateInputName(key: string): string {
  return `campo_${key}`;
}

/**
 * De lo que llegó de la pantalla de configuración, las dos listas que se guardan.
 *
 * Los campos fijos nunca entran: aunque alguien mande `campo_orgName=OCULTO` en el `FormData`,
 * acá se ignora. Un campo sin valor —o con un valor que no es ninguno de los tres estados— cae
 * en opcional, que es lo mismo que hace el resto de esta acción con un campo que no llegó.
 */
export function parseRequestFieldStates(form: Record<string, string>): {
  hidden: string[];
  required: string[];
} {
  const hidden: string[] = [];
  const required: string[] = [];
  for (const campo of REQUEST_FIELDS) {
    if (campo.fixed) continue;
    const estado = form[requestFieldStateInputName(campo.key)];
    if (estado === "OCULTO") hidden.push(campo.key);
    else if (estado === "OBLIGATORIO") required.push(campo.key);
  }
  return { hidden, required };
}
