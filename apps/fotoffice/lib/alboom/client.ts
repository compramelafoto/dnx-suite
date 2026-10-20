/**
 * Cliente de la API INTERNA de Alboom: la misma que usa su panel (`https://<subdominio>.alboomcrm.com/api`). No es
 * pública ni documentada; si Alboom la cambia, esto falla con `AlboomApiError` y la extracción lo registra.
 *
 * SÓLO LEE. Toda llamada pasa por `leer`, que exige que el método y la ruta estén en `RUTAS_DE_LECTURA` (lista
 * blanca exacta, con la forma de los parámetros) y lanza `AlboomRutaNoPermitidaError` ANTES de tocar la red con
 * cualquier otra cosa: nada de `PUT`, `DELETE` ni `POST` que escriba. Ojo: Alboom tiene `GET` que escriben
 * (`/settings/erase_finance`, `/settings/update_apikey`, `/products/clone_costs/...`), por eso la lista es de rutas
 * y no de métodos. La única otra salida a la red es el inicio de sesión (`POST /users/login`).
 *
 * El inicio de sesión devuelve un token que viaja como `Authorization: Bearer`. Ante un 401 se vuelve a iniciar
 * sesión una sola vez. Ritmo: a lo sumo un pedido por segundo (contando el inicio de sesión).
 *
 * Basado en el cliente del Asistente de ventas (rama `feat/fotoffice-asistente-ventas`, nunca fusionada).
 * Sin `server-only` a propósito: no lee la base ni el entorno, y así se prueba con un `fetch` falso.
 */

export class AlboomLoginError extends Error {
  constructor(message = "Alboom rechazó el usuario o la contraseña") {
    super(message);
    this.name = "AlboomLoginError";
  }
}

export class AlboomApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** 429, 5xx, red caída o tiempo agotado: vale la pena reintentar más tarde. */
    readonly transitorio: boolean = false,
  ) {
    super(message);
    this.name = "AlboomApiError";
  }
}

export class AlboomRutaNoPermitidaError extends Error {
  constructor(method: string, ruta: string) {
    // La ruta no lleva datos de la cuenta (sólo ids numéricos), así que se puede nombrar.
    super(`Ruta de Alboom no permitida (sólo lectura): ${method} ${ruta.slice(0, 120)}`);
    this.name = "AlboomRutaNoPermitidaError";
  }
}

export type CredencialAlboom = { subdomain: string; username: string; password: string };

export type PedidoLectura = { method: "GET" | "POST"; ruta: string; body?: Record<string, unknown> };

export type ClienteAlboom = {
  /** Un pedido de lectura de la lista blanca. Devuelve el JSON tal cual lo manda Alboom. */
  leer(pedido: PedidoLectura): Promise<unknown>;
  /** Pedidos hechos a Alboom por este cliente, incluido el inicio de sesión. */
  pedidosHechos(): number;
};

export type OpcionesCliente = {
  fetchImpl?: typeof fetch;
  /** Reloj en milisegundos. Las pruebas lo reemplazan. */
  ahora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  /** Mínimo entre dos pedidos. Por omisión 1000 ms: un pedido por segundo. */
  intervaloMs?: number;
  timeoutMs?: number;
};

const ID = String.raw`\d{1,12}`;

/**
 * Lista blanca de lectura: método + ruta completa (con la consulta). Cada entrada sale de los documentos
 * `docs/alboom/01`–`05`. Los `POST` son todos listados (`paginate`): leen con filtros en el cuerpo.
 */
export const RUTAS_DE_LECTURA: readonly { method: "GET" | "POST"; patron: RegExp }[] = [
  // Configuración y catálogos.
  // `GET /settings` sin barra final: así lo pide el panel (AngularJS saca la barra). Con barra, Alboom da 404.
  { method: "GET", patron: /^\/settings$/ },
  { method: "GET", patron: /^\/settings\/custom_mail_templates$/ },
  { method: "GET", patron: /^\/settings\/custom_messages_whatsapp$/ },
  { method: "GET", patron: /^\/stages\/list\?type=(lead_stage|stage|order_stage)$/ },
  { method: "GET", patron: /^\/categories\?type=[a-z_]{1,30}$/ },
  { method: "GET", patron: /^\/categories\/list\?type=(payment|class)$/ },
  { method: "GET", patron: /^\/tags\?type=[a-z_]{1,30}$/ },
  { method: "GET", patron: /^\/eventtypes$/ },
  { method: "GET", patron: /^\/accounts\?subtype=[RCD]$/ },
  { method: "GET", patron: /^\/products\/all$/ },
  { method: "GET", patron: new RegExp(`^/products/pack/${ID}$`) },
  { method: "GET", patron: new RegExp(`^/products/costs/${ID}$`) },
  { method: "GET", patron: /^\/agreement_templates$/ },
  // Detalles e historiales por registro.
  { method: "GET", patron: new RegExp(`^/leads/progress/${ID}/\\d{1,6}/\\d{1,6}$`) },
  { method: "GET", patron: new RegExp(`^/mails/leads/${ID}/\\d{1,6}/\\d{1,6}$`) },
  // Detalle de un presupuesto / pedido: `GET /quotes/<id>` y `GET /orders/<id>` (sólo dígitos: `/orders/all`,
  // `/orders/list`… no entran). `GET /quotes?id=` da 500 en Alboom y el panel no lo usa.
  { method: "GET", patron: new RegExp(`^/quotes/${ID}$`) },
  { method: "GET", patron: new RegExp(`^/orders/${ID}$`) },
  { method: "GET", patron: new RegExp(`^/orders/items\\?id=${ID}$`) },
  { method: "GET", patron: new RegExp(`^/costs/orders/${ID}$`) },
  { method: "GET", patron: new RegExp(`^/agreements/${ID}$`) },
  { method: "GET", patron: new RegExp(`^/projects/progress/${ID}/\\d{1,6}/\\d{1,6}$`) },
  { method: "GET", patron: /^\/tasks\?offset=\d{1,7}&filteruser=all$/ },
  // Listados paginados (POST que sólo leen).
  { method: "POST", patron: /^\/users\/paginate$/ },
  { method: "POST", patron: /^\/contacts\/paginate$/ },
  { method: "POST", patron: /^\/leads\/paginate$/ },
  { method: "POST", patron: /^\/notes\/paginate$/ },
  { method: "POST", patron: /^\/activities\/paginate$/ },
  { method: "POST", patron: /^\/quotes\/paginate$/ },
  { method: "POST", patron: /^\/orders\/paginate$/ },
  { method: "POST", patron: /^\/agreements\/paginate$/ },
  { method: "POST", patron: /^\/projects\/paginate$/ },
  { method: "POST", patron: /^\/participants\/paginate$/ },
  { method: "POST", patron: /^\/events\/paginate$/ },
  { method: "POST", patron: /^\/banks\/paginate$/ },
  { method: "POST", patron: /^\/account_trans\/paginate$/ },
  { method: "POST", patron: /^\/account_trans\/paginate_apr$/ },
];

export function esRutaDeLectura(method: string, ruta: string): boolean {
  if (typeof ruta !== "string" || ruta.length > 300) return false;
  return RUTAS_DE_LECTURA.some((r) => r.method === method && r.patron.test(ruta));
}

const SUBDOMINIO = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export function subdominioValido(subdomain: string): boolean {
  return SUBDOMINIO.test(subdomain);
}

/** "2026-10-12T09:30:00.000": la hora de Buenos Aires sin zona, como la manda el panel al iniciar sesión. */
export function horaLocalAlboom(d: Date): string {
  return new Date(d.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, -1);
}

/** 3xx, o la respuesta opaca que da `redirect: "manual"` en algunos entornos (status 0). */
function esRedireccion(res: Response): boolean {
  return res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400);
}

function esTransitorio(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Inicia sesión y devuelve el cliente listo. Lanza `AlboomLoginError` si Alboom rechaza la credencial y
 * `AlboomApiError` si no se pudo hablar con Alboom. Ningún mensaje de error lleva el usuario ni la contraseña.
 */
export async function crearClienteAlboom(cred: CredencialAlboom, opciones: OpcionesCliente = {}): Promise<ClienteAlboom> {
  if (!subdominioValido(cred.subdomain)) throw new AlboomApiError("Subdominio de Alboom inválido");
  const fetchImpl = opciones.fetchImpl ?? fetch;
  const ahora = opciones.ahora ?? (() => Date.now());
  const esperar = opciones.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const intervaloMs = opciones.intervaloMs ?? 1000;
  // 15 s: el peor caso de un pedido (pedido + nuevo inicio de sesión + reintento) entra en el margen de la tanda.
  const timeoutMs = opciones.timeoutMs ?? 15_000;
  const base = `https://${cred.subdomain.toLowerCase()}.alboomcrm.com/api`;
  let token = "";
  let ultimo: number | null = null;
  let hechos = 0;

  /** Un pedido por segundo como mucho, contando el inicio de sesión. */
  async function turno(): Promise<void> {
    if (ultimo !== null) {
      const falta = ultimo + intervaloMs - ahora();
      if (falta > 0) await esperar(falta);
    }
    ultimo = ahora();
    hechos++;
  }

  async function login(): Promise<void> {
    await turno();
    let res: Response;
    try {
      res = await fetchImpl(`${base}/users/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: cred.username,
          password: cred.password,
          type: "simple",
          login_time: horaLocalAlboom(new Date(ahora())),
          keepme: true,
        }),
        signal: AbortSignal.timeout(timeoutMs),
        // Nunca seguir redirecciones: un 307/308 reenviaría el usuario y la contraseña a donde diga `Location`.
        redirect: "manual",
      });
    } catch {
      throw new AlboomApiError("No se pudo conectar con Alboom", undefined, true);
    }
    if (esRedireccion(res)) throw new AlboomApiError("Alboom respondió con una redirección al iniciar sesión: no se sigue", res.status);
    // Sólo un rechazo EXPLÍCITO de la credencial es AlboomLoginError (un 401, o un 2xx que dice
    // `status: "error"`), porque ese error pide volver a conectar. Un 429 o un 5xx son de Alboom.
    if (res.status === 401) throw new AlboomLoginError();
    if (!res.ok) throw new AlboomApiError(`Alboom respondió ${res.status} al iniciar sesión`, res.status, esTransitorio(res.status));
    const data = (await res.json().catch(() => null)) as { status?: string; token?: string } | null;
    if (data?.status === "ok" && typeof data.token === "string" && data.token) {
      token = data.token;
      return;
    }
    if (data?.status === "error") throw new AlboomLoginError();
    throw new AlboomApiError("Alboom respondió algo inesperado al iniciar sesión", res.status);
  }

  async function pedir(pedido: PedidoLectura, reintento: boolean): Promise<unknown> {
    await turno();
    let res: Response;
    try {
      res = await fetchImpl(`${base}${pedido.ruta}`, {
        method: pedido.method,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: pedido.method === "POST" ? JSON.stringify(pedido.body ?? {}) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        // Nunca seguir redirecciones: la lista blanca vale para la ruta pedida, no para la de `Location`.
        redirect: "manual",
      });
    } catch {
      throw new AlboomApiError(`No se pudo leer ${pedido.ruta.slice(0, 120)}`, undefined, true);
    }
    if (esRedireccion(res)) throw new AlboomApiError(`Alboom respondió con una redirección en ${pedido.ruta.slice(0, 120)}: no se sigue`, res.status);
    if (res.status === 401 && reintento) {
      await login();
      return pedir(pedido, false);
    }
    if (res.status === 401) throw new AlboomLoginError("Alboom rechazó la sesión");
    if (!res.ok) {
      throw new AlboomApiError(`Alboom respondió ${res.status} en ${pedido.ruta.slice(0, 120)}`, res.status, esTransitorio(res.status));
    }
    const data: unknown = await res.json().catch(() => undefined);
    if (data === undefined) throw new AlboomApiError(`Respuesta no JSON en ${pedido.ruta.slice(0, 120)}`, res.status);
    return data;
  }

  await login();

  return {
    async leer(pedido) {
      // La lista blanca va antes que todo: una ruta fuera de ella no llega nunca a la red.
      if (!pedido || (pedido.method !== "GET" && pedido.method !== "POST") || !esRutaDeLectura(pedido.method, pedido.ruta)) {
        throw new AlboomRutaNoPermitidaError(String(pedido?.method), String(pedido?.ruta));
      }
      if (pedido.method === "GET" && pedido.body !== undefined) {
        throw new AlboomRutaNoPermitidaError(pedido.method, pedido.ruta);
      }
      return pedir(pedido, true);
    },
    pedidosHechos() {
      return hechos;
    },
  };
}
