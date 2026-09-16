/**
 * Qué le pregunta cada institución a quien pide una cobertura.
 *
 * El formulario público es la única pantalla del módulo que ve gente de afuera, y no todas las
 * organizaciones necesitan las mismas 23 preguntas: una pide el CUIT porque después factura,
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
  | "textarea";

export type RequestFieldDef = {
  key: string;
  label: string;
  section: RequestFieldSectionKey;
  input: RequestFieldInput;
  /** Un campo fijo ignora las dos listas: siempre se pregunta y siempre es obligatorio. */
  fixed: boolean;
  /** Por qué es fijo. Se muestra en la pantalla de configuración, en vez de esconder el campo. */
  fixedReason?: string;
};

/**
 * Los 23 campos del formulario público, en el orden en que aparecen.
 *
 * Las claves son las mismas que lee `parseCoverageRequest` y las mismas que viajan como `name`
 * en el formulario: son el contrato entre las tres partes. Un campo nuevo se agrega acá y
 * aparece solo en las tres pantallas; una clave que no coincida no da error, simplemente deja
 * de configurarse.
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
  { key: "contactName", label: "Con quién hablamos", section: "ORGANIZACION", input: "text", fixed: false },
  { key: "contactRole", label: "Qué rol tiene", section: "ORGANIZACION", input: "text", fixed: false },
  {
    key: "contactEmail",
    label: "Correo",
    section: "ORGANIZACION",
    input: "email",
    fixed: true,
    fixedReason: "Sin correo no hay enlace de seguimiento ni forma de contestar.",
  },
  { key: "contactPhone", label: "Teléfono o WhatsApp", section: "ORGANIZACION", input: "tel", fixed: false },
  {
    key: "eventTitle",
    label: "Cómo se llama",
    section: "ACTIVIDAD",
    input: "text",
    fixed: true,
    fixedReason: "La cobertura se genera con este dato.",
  },
  { key: "eventDescription", label: "Contanos de qué se trata", section: "ACTIVIDAD", input: "textarea", fixed: false },
  {
    key: "startsAt",
    label: "Cuándo empieza",
    section: "ACTIVIDAD",
    input: "datetime-local",
    fixed: true,
    fixedReason: "La cobertura se genera con este dato.",
  },
  {
    key: "endsAt",
    label: "Cuándo termina",
    section: "ACTIVIDAD",
    input: "datetime-local",
    fixed: true,
    fixedReason: "La cobertura se genera con este dato.",
  },
  { key: "addressLine", label: "Dirección", section: "ACTIVIDAD", input: "text", fixed: false },
  { key: "city", label: "Localidad", section: "ACTIVIDAD", input: "text", fixed: false },
  { key: "expectedAttendees", label: "Cuánta gente esperan", section: "ACTIVIDAD", input: "number", fixed: false },
  { key: "onSiteContactName", label: "Quién va a estar ese día", section: "ACTIVIDAD", input: "text", fixed: false },
  { key: "onSitePhone", label: "Su teléfono", section: "ACTIVIDAD", input: "tel", fixed: false },
  { key: "purpose", label: "Para qué van a usar las fotos", section: "NECESIDAD", input: "textarea", fixed: false },
  { key: "keyMoments", label: "Qué momentos no se pueden perder", section: "NECESIDAD", input: "textarea", fixed: false },
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
  { key: "notes", label: "Algo más que quieran contarnos", section: "NECESIDAD", input: "textarea", fixed: false },
] as const;

export const FIXED_REQUEST_FIELD_KEYS: readonly string[] = REQUEST_FIELDS.filter((f) => f.fixed).map(
  (f) => f.key,
);

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

/** El estado de los 23 campos, por clave. */
export function resolveRequestFieldStates(
  config: RequestFormFieldConfig,
): Record<string, RequestFieldState> {
  const out: Record<string, RequestFieldState> = {};
  for (const campo of REQUEST_FIELDS) out[campo.key] = resolveRequestFieldState(campo, config);
  return out;
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
