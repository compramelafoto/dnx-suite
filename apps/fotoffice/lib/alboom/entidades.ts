import type { PedidoLectura } from "./client";

/**
 * Catálogo de lo que se extrae de Alboom, en orden de dependencias (los catálogos antes que los registros que los
 * usan, y cada padre antes que sus hijos). Cada entidad tiene su propia entrada en el avance.
 *
 * Orden de trabajo (21/10/2026): catálogos, contactos y el listado de oportunidades; después presupuestos, pedidos,
 * contratos, proyectos, agenda y finanzas con sus hijos; y AL FINAL los hijos de las oportunidades (historial,
 * notas, actividades, correos), que son miles de pedidos y lo menos importante para la migración.
 *
 * Los endpoints y sus parámetros salen de `apps/fotoffice/docs/alboom/01`–`05` (tablas "qué extraer"/"datos a
 * migrar") y de `09-configuracion-real-dnx.md`. Donde el documento no fija la forma de la respuesta, el extractor
 * guarda lo que venga tal cual y suma una "duda" si algo no cierra (sin id, forma desconocida).
 *
 * Sin `server-only` ni base: lo importan el extractor y las pruebas; las pantallas sólo usan `nombre`.
 */

/** Filas de una respuesta, o `null` si la respuesta no tiene la forma esperada. */
export type Filas = (json: unknown) => unknown[] | null;

export type Fuente =
  /** Un solo pedido; `filas` arma los registros. */
  | { tipo: "simple"; pedido: PedidoLectura; filas: Filas }
  /** Varios pedidos fijos (p. ej. un tipo de categoría por pedido); el id se guarda como "<clave>/<id>". */
  | { tipo: "varias"; pedidos: readonly { clave: string; pedido: PedidoLectura }[]; filas: Filas }
  /** Listado `paginate` de Alboom: `{ rows, count }` con `pageNumber` (desde 1) y `pageSize`. */
  | { tipo: "paginada"; ruta: string; body: (pagina: number, tamano: number) => Record<string, unknown> }
  /** `GET` con desplazamiento; sigue hasta una página vacía. */
  | { tipo: "porDesplazamiento"; ruta: (offset: number) => string }
  /**
   * Un pedido (o varios, con desplazamiento) por cada registro ya extraído de `padre`. El id se guarda como
   * "<idPadre>/<id>", salvo con `mismoId` (el detalle de un registro: un solo objeto con el id del padre).
   */
  | {
      tipo: "porPadre";
      padre: string;
      pedido: (idPadre: string, offset: number) => PedidoLectura;
      filas: Filas;
      /** Con tamaño de página, pide `offset` 0, n, 2n… mientras vengan n filas. */
      paginaDe?: number;
      /** Sólo los padres que cumplen (p. ej. productos que son combo). */
      filtro?: (payload: unknown) => boolean;
      mismoId?: boolean;
      /**
       * El hijo sale de lo mismo que la fila del padre (p. ej. el historial de etapas: cambiar de etapa cambia el
       * padre). Con esto (o `mismoId`), "Volver a extraer" lo pide sólo de los padres que cambiaron.
       */
      reflejaPadre?: boolean;
    }
  /** Sin pedidos: sale de lo ya extraído de otra entidad (p. ej. los orígenes, de la configuración). */
  | { tipo: "derivada"; de: string; filas: Filas }
  /** No hay endpoint de lectura conocido: queda "no disponible" en el avance. */
  | { tipo: "noDisponible"; motivo: string };

export type Entidad = {
  clave: string;
  nombre: string;
  fuente: Fuente;
  /** Campos que identifican el registro si no trae `id` (en orden). */
  claves?: readonly string[];
  /** Id fijo (la configuración es un único objeto). */
  idFijo?: string;
  /**
   * `false` cuando el documento ya dice que los registros no traen id (historiales): se identifican por su huella
   * sin sumar una duda.
   */
  idEsperado?: boolean;
  /**
   * Versión de la forma de pedir. Si cambia (p. ej. se corrigió el endpoint), una extracción en curso que la tenga
   * con otra versión rehace esa entidad desde cero en vez de seguir con el cursor viejo. Sin versión = 1.
   */
  version?: number;
  /** Listados paginados: tamaño de página propio (si no, `TAMANO_PAGINA`). */
  tamanoPagina?: number;
};

export const TAMANO_PAGINA = 100;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Un arreglo, `{ rows: [...] }` o `{ data: [...] }` → filas. Cualquier otra forma es `null` (forma desconocida). */
export const filasDeLista: Filas = (json) => {
  if (Array.isArray(json)) return json;
  if (esObjeto(json)) {
    if (Array.isArray(json.rows)) return json.rows;
    if (Array.isArray(json.data)) return json.data;
  }
  return null;
};

/** Un único objeto (un detalle, la configuración). */
export const filaUnica: Filas = (json) => (esObjeto(json) ? [json] : null);

/** `GET /stages/list` → `{ stage_list: [embudos], stages: { <id>: [etapas] } }`. */
const embudosDe: Filas = (json) => (esObjeto(json) && Array.isArray(json.stage_list) ? json.stage_list : null);
const etapasDe: Filas = (json) => {
  if (!esObjeto(json) || !esObjeto(json.stages)) return null;
  return Object.values(json.stages).flatMap((v) => (Array.isArray(v) ? v : []));
};

/** Orígenes de oportunidad: `lead_origin` es texto, una opción por línea (doc 05 §3.24). */
const origenesDe: Filas = (json) => {
  if (!esObjeto(json)) return null;
  const texto = json.lead_origin;
  if (texto == null || texto === "") return [];
  if (typeof texto !== "string") return null;
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((name, i) => ({ name, posicion: i + 1 }));
};

/** Correos del sistema: `MailTemplates.{clave}.{subject,body,files}` (doc 05 §13.2). */
const plantillasSistemaDe: Filas = (json) => {
  if (!esObjeto(json)) return null;
  const mt = json.MailTemplates ?? json.mail_templates;
  if (mt == null) return [];
  if (!esObjeto(mt)) return null;
  return Object.entries(mt).map(([key, valor]) => ({ key, ...(esObjeto(valor) ? valor : { valor }) }));
};

/** Plan de pagos del pedido: `order_payments[]` dentro del detalle (doc 02 §17.3); a veces llega como objeto. */
const cuotasDe: Filas = (json) => {
  if (!esObjeto(json)) return null;
  const pedido = esObjeto(json.order) ? json.order : json;
  const cuotas = pedido.order_payments;
  if (cuotas == null) return [];
  if (Array.isArray(cuotas)) return cuotas;
  if (esObjeto(cuotas)) return Object.values(cuotas);
  return null;
};

const esCombo = (p: unknown) => esObjeto(p) && (p.pack === 1 || p.pack === "1" || p.pack === true);

const listado =
  (extra: Record<string, unknown> = {}, sortDir: "ASC" | "DESC" = "ASC") =>
  (pagina: number, tamano: number) => ({
    ...extra,
    pageNumber: pagina,
    pageSize: tamano,
    sortBy: "id",
    sortDir,
    searchTerm: "",
  });

const get = (ruta: string): PedidoLectura => ({ method: "GET", ruta });

/** Todo el historial: el panel manda un rango de fechas aunque el período sea "todos". */
const DESDE_SIEMPRE = "2000-01-01T03:00:00.000Z";
const HASTA_SIEMPRE = "2099-12-31T03:00:00.000Z";

/**
 * Cuentas a cobrar y a pagar (doc 04 §20): `type` ar, ap, ar_paid, ap_paid → `{ rows, count, total }`.
 * Lo mismo que manda el panel (`getAPRData` en `js/alboomcrm.min.js`): `customer_id` y `groupBy` nulos, sin
 * `user_id`, orden por `account_trans.id`. Con `customer_id`/`user_id` en "all" o `groupBy` vacío Alboom
 * respondía 500 (probado en el panel de DNX el 25/10/2026: ar 151, ap 163, ar_paid 1395, ap_paid 260).
 */
const cuentas = (type: string) => (pageNumber: number, pageSize: number) => ({
  type,
  class_id: "all",
  doc_type: "all",
  customer_id: null,
  groupBy: null,
  pageNumber,
  pageSize,
  sortBy: "account_trans.id",
  sortDir: "ASC",
  searchTerm: "",
  period: "all",
  start_date: DESDE_SIEMPRE,
  end_date: HASTA_SIEMPRE,
  csv_mode: 0,
});

export const ENTIDADES: readonly Entidad[] = [
  // ── Configuración y catálogos ─────────────────────────────────────────────
  // El panel llama `Settings.get({})` → `$resource("/settings/:username")`, y AngularJS saca la barra final: el
  // pedido real es `GET /settings`. `GET /settings/` (con barra) da 404 (extracción real de DNX, 13/10/2026).
  { clave: "configuracion", nombre: "Configuración", idFijo: "settings", version: 2, fuente: { tipo: "simple", pedido: get("/settings"), filas: filaUnica } },
  { clave: "origenes", nombre: "Orígenes de oportunidad", claves: ["name"], version: 2, fuente: { tipo: "derivada", de: "configuracion", filas: origenesDe } },
  {
    clave: "plantillas_sistema",
    nombre: "Correos del sistema",
    claves: ["key"],
    version: 2,
    fuente: { tipo: "derivada", de: "configuracion", filas: plantillasSistemaDe },
  },
  {
    clave: "plantillas_correo",
    nombre: "Plantillas de correo personales",
    claves: ["subject"],
    fuente: { tipo: "simple", pedido: get("/settings/custom_mail_templates"), filas: filasDeLista },
  },
  {
    clave: "plantillas_whatsapp",
    nombre: "Plantillas de WhatsApp",
    claves: ["subject"],
    fuente: { tipo: "simple", pedido: get("/settings/custom_messages_whatsapp"), filas: filasDeLista },
  },
  { clave: "usuarios", nombre: "Usuarios", claves: ["email"], fuente: { tipo: "paginada", ruta: "/users/paginate", body: listado({ type: "all" }) } },
  { clave: "embudos", nombre: "Embudos de venta", fuente: { tipo: "simple", pedido: get("/stages/list?type=lead_stage"), filas: embudosDe } },
  { clave: "etapas_embudo", nombre: "Etapas de los embudos", fuente: { tipo: "simple", pedido: get("/stages/list?type=lead_stage"), filas: etapasDe } },
  { clave: "flujos_proyecto", nombre: "Flujos de proyecto", fuente: { tipo: "simple", pedido: get("/stages/list?type=stage"), filas: embudosDe } },
  { clave: "etapas_flujo", nombre: "Etapas de los flujos", fuente: { tipo: "simple", pedido: get("/stages/list?type=stage"), filas: etapasDe } },
  {
    clave: "tareas_pedido",
    nombre: "Plantillas de tareas de pedido",
    idFijo: "order_stage",
    fuente: { tipo: "simple", pedido: get("/stages/list?type=order_stage"), filas: filaUnica },
  },
  {
    clave: "categorias",
    nombre: "Categorías",
    claves: ["name"],
    fuente: {
      tipo: "varias",
      // contacto, participante, nota, producto, presupuesto/oportunidad y clase (doc 05 §3.11–3.12).
      pedidos: ["contact", "participant", "action", "product", "lead_type", "class"].map((t) => ({ clave: t, pedido: get(`/categories?type=${t}`) })),
      filas: filasDeLista,
    },
  },
  {
    clave: "etiquetas",
    nombre: "Etiquetas",
    claves: ["tag", "name"],
    fuente: { tipo: "varias", pedidos: ["leads", "contacts"].map((t) => ({ clave: t, pedido: get(`/tags?type=${t}`) })), filas: filasDeLista },
  },
  { clave: "tipos_cita", nombre: "Tipos de cita", claves: ["name"], fuente: { tipo: "simple", pedido: get("/eventtypes"), filas: filasDeLista } },
  { clave: "metodos_pago", nombre: "Métodos de pago", claves: ["name"], fuente: { tipo: "simple", pedido: get("/categories/list?type=payment"), filas: filasDeLista } },
  {
    clave: "plan_cuentas",
    nombre: "Plan de cuentas",
    fuente: { tipo: "varias", pedidos: ["R", "C", "D"].map((t) => ({ clave: t, pedido: get(`/accounts?subtype=${t}`) })), filas: filasDeLista },
  },
  { clave: "bancos", nombre: "Bancos y cajas", fuente: { tipo: "paginada", ruta: "/banks/paginate", body: listado({ type: "all", category_id: "all" }) } },
  { clave: "productos", nombre: "Productos y combos", claves: ["code"], fuente: { tipo: "simple", pedido: get("/products/all"), filas: filasDeLista } },
  {
    clave: "combos",
    nombre: "Contenido de los combos",
    idEsperado: false,
    fuente: { tipo: "porPadre", padre: "productos", filtro: esCombo, pedido: (id) => get(`/products/pack/${id}`), filas: filasDeLista },
  },
  {
    clave: "costos_producto",
    nombre: "Costos de los productos",
    fuente: { tipo: "porPadre", padre: "productos", pedido: (id) => get(`/products/costs/${id}`), filas: filasDeLista },
  },
  { clave: "plantillas_contrato", nombre: "Plantillas de contrato", claves: ["name"], fuente: { tipo: "simple", pedido: get("/agreement_templates"), filas: filasDeLista } },

  // ── Contactos y oportunidades ─────────────────────────────────────────────
  {
    clave: "contactos",
    nombre: "Contactos",
    fuente: { tipo: "paginada", ruta: "/contacts/paginate", body: listado({ type: "all", class_id: "all", role: "contact" }) },
  },
  {
    clave: "oportunidades",
    nombre: "Oportunidades",
    fuente: {
      tipo: "paginada",
      ruta: "/leads/paginate",
      body: listado({
        period: "all",
        start_date: "",
        end_date: "",
        pipeline: "all",
        stage: "all",
        class: "all",
        origin: "all",
        type: "all",
        user: "all",
        expired: false,
      }),
    },
  },
  // ── Presupuestos y pedidos ────────────────────────────────────────────────
  { clave: "presupuestos", nombre: "Presupuestos", fuente: { tipo: "paginada", ruta: "/quotes/paginate", body: listado({ user: "all" }) } },
  // Detalles: el panel usa `Quotes.query({id})` / `Orders.query({id})` → `GET /quotes/<id>` y `GET /orders/<id>`.
  // La acción `get` de la fábrica (`GET /quotes?id=`) existe pero el panel nunca la usa, y Alboom responde 500 a
  // todos (extracción real de DNX, 13/10/2026: 174 de 174). El listado no trae los ítems (`quote_item_count` 0).
  {
    clave: "presupuestos_detalle",
    nombre: "Detalle de presupuestos (con ítems)",
    version: 2,
    fuente: { tipo: "porPadre", padre: "presupuestos", mismoId: true, pedido: (id) => get(`/quotes/${id}`), filas: filaUnica },
  },
  {
    // Lo mismo que manda el panel de Alboom (`OrdersController.getData` en `js/alboomcrm.min.js`), de a 25 y por id
    // descendente. Con lo de antes (sin `class` ni `end_date`, ASC, de a 100) Alboom respondía 500 (13–16/10/2026).
    clave: "pedidos",
    nombre: "Pedidos",
    version: 2,
    tamanoPagina: 25,
    fuente: {
      tipo: "paginada",
      ruta: "/orders/paginate",
      body: (pageNumber, pageSize) => ({
        type: "all",
        class: null,
        user: "all",
        pageNumber,
        pageSize,
        sortBy: "id",
        sortDir: "DESC",
        searchTerm: "",
        period: "all",
        period_job: "all",
        start_date: "all",
        end_date: null,
      }),
    },
  },
  {
    clave: "pedidos_detalle",
    nombre: "Detalle de pedidos",
    version: 2,
    fuente: { tipo: "porPadre", padre: "pedidos", mismoId: true, pedido: (id) => get(`/orders/${id}`), filas: filaUnica },
  },
  {
    clave: "pedidos_items",
    nombre: "Ítems de pedidos",
    fuente: { tipo: "porPadre", padre: "pedidos", pedido: (id) => get(`/orders/items?id=${id}`), filas: filasDeLista },
  },
  { clave: "pedidos_plan_pagos", nombre: "Plan de pagos de pedidos", version: 2, fuente: { tipo: "derivada", de: "pedidos_detalle", filas: cuotasDe } },
  {
    clave: "pedidos_costos",
    nombre: "Costos de pedidos",
    fuente: { tipo: "porPadre", padre: "pedidos", pedido: (id) => get(`/costs/orders/${id}`), filas: filasDeLista },
  },

  // ── Contratos, proyectos y agenda ─────────────────────────────────────────
  // El panel ordena los contratos por id descendente (doc 03 §"Orden por defecto"); de a 25 como los pedidos.
  {
    clave: "contratos",
    nombre: "Contratos",
    version: 2,
    tamanoPagina: 25,
    fuente: { tipo: "paginada", ruta: "/agreements/paginate", body: listado({ type: "all", user: "all" }, "DESC") },
  },
  {
    clave: "contratos_detalle",
    nombre: "Detalle de contratos (texto y firma)",
    fuente: { tipo: "porPadre", padre: "contratos", mismoId: true, pedido: (id) => get(`/agreements/${id}`), filas: filaUnica },
  },
  {
    // Lo mismo que manda el panel (`ProjectsController.getData`): `class_id` (no `class`) y `expired`, que es
    // obligatorio. "false" trae todos (1010 en DNX, incluidos los 84 vencidos que trae "true"); sin `expired`
    // Alboom responde 500 hasta de a 1 (extracciones del 21/10/2026, probado en el panel el 25/10).
    clave: "proyectos",
    nombre: "Proyectos",
    version: 2,
    tamanoPagina: 25,
    fuente: {
      tipo: "paginada",
      ruta: "/projects/paginate",
      body: (pageNumber, pageSize) => ({
        type: "all",
        class_id: "all",
        user: "all",
        expired: "false",
        pageNumber,
        pageSize,
        pipeline: "all",
        stage: "all",
        sortBy: "id",
        sortDir: "DESC",
        searchTerm: "",
      }),
    },
  },
  {
    clave: "proyectos_historial",
    nombre: "Historial de etapas de proyectos",
    idEsperado: false,
    fuente: { tipo: "porPadre", padre: "proyectos", reflejaPadre: true, pedido: (id) => get(`/projects/progress/${id}/0/9999`), filas: filasDeLista },
  },
  {
    clave: "proyectos_participantes",
    nombre: "Participantes de proyectos",
    fuente: {
      tipo: "porPadre",
      padre: "proyectos",
      // El panel pide de a `count` desde `offset` (`ParticipantsController.getData`); sin esos campos, 500.
      pedido: (id) => ({ method: "POST", ruta: "/participants/paginate", body: { type: "projects", id, offset: 0, count: 500, searchTerm: "" } }),
      filas: filasDeLista,
    },
  },
  { clave: "tareas", nombre: "Tareas", fuente: { tipo: "porDesplazamiento", ruta: (offset) => `/tasks?offset=${offset}&filteruser=all` } },
  {
    // Lo mismo que manda la lista del calendario (`CalendarController.getData`): `start_type` "other" (Otro
    // período) con el rango de fechas; "all" da 500 y "0" es sólo desde hoy (453 citas en DNX el 25/10/2026).
    clave: "citas",
    nombre: "Citas",
    version: 2,
    fuente: {
      tipo: "paginada",
      ruta: "/events/paginate",
      body: listado({ start_type: "other", type: "all", class_id: "all", status: "All", user: "all", start_date: DESDE_SIEMPRE, end_date: HASTA_SIEMPRE, is_csv: 0 }),
    },
  },

  // ── Finanzas ──────────────────────────────────────────────────────────────
  { clave: "cuentas_cobrar", nombre: "Cuentas a cobrar", fuente: { tipo: "paginada", ruta: "/account_trans/paginate_apr", body: cuentas("ar") } },
  { clave: "cuentas_pagar", nombre: "Cuentas a pagar", fuente: { tipo: "paginada", ruta: "/account_trans/paginate_apr", body: cuentas("ap") } },
  { clave: "cobros", nombre: "Cobros recibidos", fuente: { tipo: "paginada", ruta: "/account_trans/paginate_apr", body: cuentas("ar_paid") } },
  { clave: "pagos", nombre: "Pagos hechos", fuente: { tipo: "paginada", ruta: "/account_trans/paginate_apr", body: cuentas("ap_paid") } },
  {
    clave: "movimientos_bancos",
    nombre: "Movimientos de bancos",
    version: 2,
    fuente: {
      tipo: "paginada",
      ruta: "/account_trans/paginate",
      // Lo mismo que manda Bancos → Movimientos con "Todas" las cuentas (`getTransactionsData`): `type`
      // "transactions" y `account_id` "all" (1713 movimientos en DNX el 25/10/2026; lo de antes daba 500).
      body: (pageNumber, pageSize) => ({
        type: "transactions",
        account_id: "all",
        pageNumber,
        pageSize,
        sortBy: "account_trans.id",
        sortDir: "ASC",
        searchTerm: "",
        period: "all",
        start_date: DESDE_SIEMPRE,
        end_date: HASTA_SIEMPRE,
        csv_mode: 0,
      }),
    },
  },

  // ── Hijos de las oportunidades (al final: miles de pedidos, lo menos urgente) ──
  {
    clave: "oportunidades_historial",
    nombre: "Historial de etapas de oportunidades",
    idEsperado: false,
    fuente: { tipo: "porPadre", padre: "oportunidades", reflejaPadre: true, pedido: (id) => get(`/leads/progress/${id}/0/9999`), filas: filasDeLista },
  },
  {
    clave: "oportunidades_notas",
    nombre: "Notas de oportunidades",
    fuente: {
      tipo: "porPadre",
      padre: "oportunidades",
      paginaDe: 50,
      pedido: (id, offset) => ({ method: "POST", ruta: "/notes/paginate", body: { type: "leads", id, offset, count: 50, searchTerm: "" } }),
      filas: filasDeLista,
    },
  },
  {
    clave: "oportunidades_actividades",
    nombre: "Actividades de oportunidades",
    idEsperado: false,
    fuente: {
      tipo: "porPadre",
      padre: "oportunidades",
      paginaDe: 50,
      pedido: (id, offset) => ({ method: "POST", ruta: "/activities/paginate", body: { type: "leads", id, offset, count: 50, searchTerm: "" } }),
      filas: filasDeLista,
    },
  },
  {
    clave: "oportunidades_correos",
    nombre: "Correos y WhatsApp de oportunidades",
    fuente: { tipo: "porPadre", padre: "oportunidades", paginaDe: 50, pedido: (id, offset) => get(`/mails/leads/${id}/${offset}/50`), filas: filasDeLista },
  },
];

const POR_CLAVE = new Map(ENTIDADES.map((e) => [e.clave, e]));

export function entidadPorClave(clave: string): Entidad | undefined {
  return POR_CLAVE.get(clave);
}

/** El nombre para la pantalla; una clave desconocida se muestra tal cual. */
export function nombreEntidad(clave: string): string {
  return POR_CLAVE.get(clave)?.nombre ?? clave;
}
