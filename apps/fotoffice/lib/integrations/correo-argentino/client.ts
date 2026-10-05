import { decimalArsToMinor } from "@/lib/membership/money";
import { MiCorreoError } from "./errors";

/**
 * Cliente de la API MiCorreo de Correo Argentino.
 *
 * Referencia: `docs/integraciones/correo-argentino-micorreo-api.md` (PDF de Correo del
 * 8/8/2022). Los nombres de campos de pedidos y respuestas son los de esa referencia, tal
 * cual. Donde la referencia es ambigua, se parsea a la defensiva; cada supuesto está
 * anotado con "SUPUESTO" para poder revisarlo contra el ambiente de pruebas de Correo.
 *
 * Sin base y sin `server-only`: la red entra por `fetchImpl` (por defecto el `fetch`
 * global) para que los tests nunca salgan a internet. Igual, sólo se usa desde el servidor:
 * las credenciales no pueden llegar al navegador.
 */

export type MiCorreoEnv = "TEST" | "PROD";

export const MICORREO_BASE_URLS: Record<MiCorreoEnv, string> = {
  TEST: "https://apitest.correoargentino.com.ar/micorreo/v1",
  PROD: "https://api.correoargentino.com.ar/micorreo/v1",
};

const TIMEOUT_MS = 8_000;
/** Se renueva el token este tiempo antes de que venza. */
const TOKEN_MARGIN_MS = 60_000;
/** Si `expires` no se entiende (o ya pasó), el token se usa este tiempo. */
const TOKEN_FALLBACK_TTL_MS = 10 * 60_000;
/** El texto de Correo que se conserva en los errores, como mucho. */
const MAX_MESSAGE_CHARS = 300;

export type MiCorreoDeliveredType = "D" | "S";

export type MiCorreoRate = {
  deliveredType: MiCorreoDeliveredType;
  productName: string;
  priceMinor: number;
  raw: unknown;
};

export type MiCorreoAgency = {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
};

export type MiCorreoRatesInput = {
  customerId: string;
  postalCodeOrigin: string;
  postalCodeDestination: string;
  deliveredType?: MiCorreoDeliveredType;
  dimensions: { weight: number; height: number; width: number; length: number };
};

export type MiCorreoClient = {
  getToken(): Promise<string>;
  validateUser(email: string, password: string): Promise<{ customerId: string }>;
  rates(input: MiCorreoRatesInput): Promise<MiCorreoRate[]>;
  agencies(input: { customerId: string; provinceCode: string }): Promise<MiCorreoAgency[]>;
};

export type MiCorreoClientOptions = {
  env: MiCorreoEnv;
  apiUser: string;
  apiPassword: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

// --- Caché del token -----------------------------------------------------------------------

/**
 * Por instancia del servidor, compartida entre clientes: la clave es ambiente + usuario de
 * la API, nunca la contraseña. Si la institución cambia la contraseña, el token viejo
 * sigue valiendo hasta que venza o Correo conteste 401 (y ahí se pide otro).
 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function resetMiCorreoTokenCacheForTests(): void {
  tokenCache.clear();
}

/**
 * `expires` llega como "2022-04-26 21:16:20", sin zona.
 *
 * SUPUESTO: es hora argentina (−03:00, sin horario de verano desde 2009). Si trae zona
 * (ISO con `Z` u offset), se respeta. Si la suposición fuera errada, el peor caso es usar un
 * token vencido: Correo contesta 401 y el cliente pide otro y reintenta una vez.
 */
export function parseMiCorreoExpires(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const texto = value.trim();
  const sinZona = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/.exec(texto);
  const iso = sinZona
    ? `${sinZona[1]}T${sinZona[2]}-03:00`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(texto)
      ? texto
      : null;
  if (!iso) return null;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// --- Precio --------------------------------------------------------------------------------

/**
 * `price` → centavos enteros.
 *
 * SUPUESTOS (la referencia no lo aclara): es ARS; puede venir como número (498.06, como en
 * el ejemplo) o como texto. Si es texto con coma, la coma es el decimal y los puntos son de
 * miles ("1.234,56"); si es texto sin coma, el punto es el decimal ("498.06"). Más de dos
 * decimales se recortan (mismo criterio que `lib/membership/money.ts`).
 *
 * Devuelve `null` para lo que no es un importe válido (negativo, vacío, no numérico).
 */
export function parseMiCorreoPriceToMinor(value: unknown): number | null {
  let texto: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    // `toFixed` evita la notación exponencial y el ruido de punto flotante (0.1+0.2).
    texto = value.toFixed(6);
  } else if (typeof value === "string") {
    const limpio = value.trim();
    texto = limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio;
  } else {
    return null;
  }
  if (!/^\d+(\.\d+)?$/.test(texto)) return null;
  return decimalArsToMinor(texto);
}

// --- HTTP ----------------------------------------------------------------------------------

/**
 * Los ejemplos de error de la referencia tienen comas finales (`{"code":"402",...,}`), que
 * no son JSON válido. Si el parseo estricto falla, se intenta sacándolas.
 */
function parseJsonTolerante(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    try {
      return JSON.parse(texto.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

function mensajeDeCorreo(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const { code, message } = body as { code?: unknown; message?: unknown };
  if (code === undefined || typeof message !== "string" || message.trim() === "") return null;
  return message.trim().slice(0, MAX_MESSAGE_CHARS);
}

function errorPorStatus(status: number, body: unknown): MiCorreoError {
  if (status === 401 || status === 403) {
    return new MiCorreoError("AUTH", "MiCorreo rechazó las credenciales.", status);
  }
  if (status === 429) {
    return new MiCorreoError("RATE_LIMIT", "MiCorreo pidió esperar antes de reintentar.", status);
  }
  if ([400, 402, 404, 409].includes(status)) {
    const mensaje = mensajeDeCorreo(body);
    if (mensaje) return new MiCorreoError("BUSINESS", `MiCorreo: ${mensaje}`, status);
  }
  return new MiCorreoError("UNEXPECTED", `MiCorreo respondió ${status}.`, status);
}

type RequestSpec = {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  authorization: string;
};

export function createMiCorreoClient(options: MiCorreoClientOptions): MiCorreoClient {
  const baseUrl = MICORREO_BASE_URLS[options.env];
  if (!baseUrl) throw new MiCorreoError("UNEXPECTED", "Ambiente de MiCorreo desconocido.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const cacheKey = `${options.env}:${options.apiUser}`;

  async function send(spec: RequestSpec): Promise<{ status: number; body: unknown }> {
    const url = new URL(`${baseUrl}${spec.path}`);
    for (const [k, v] of Object.entries(spec.query ?? {})) url.searchParams.set(k, v);

    const headers: Record<string, string> = { Authorization: spec.authorization, Accept: "application/json" };
    if (spec.body !== undefined) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let status: number;
    let texto: string;
    try {
      const response = await fetchImpl(url.toString(), {
        method: spec.method,
        headers,
        ...(spec.body !== undefined ? { body: JSON.stringify(spec.body) } : {}),
        signal: controller.signal,
        cache: "no-store",
      });
      status = response.status;
      texto = await response.text();
    } catch {
      // No se propaga el error original: podría arrastrar la URL o encabezados.
      throw new MiCorreoError(
        "NETWORK",
        controller.signal.aborted
          ? "MiCorreo no respondió a tiempo."
          : "No se pudo conectar con MiCorreo.",
      );
    } finally {
      clearTimeout(timer);
    }

    const body = texto.trim() === "" ? undefined : parseJsonTolerante(texto);
    if (status < 200 || status >= 300) throw errorPorStatus(status, body);
    if (body === undefined) {
      throw new MiCorreoError("UNEXPECTED", "MiCorreo devolvió una respuesta ilegible.", status);
    }
    return { status, body };
  }

  async function getToken(): Promise<string> {
    const cached = tokenCache.get(cacheKey);
    const ahora = now().getTime();
    if (cached && ahora < cached.expiresAt - TOKEN_MARGIN_MS) return cached.token;

    const basic = Buffer.from(`${options.apiUser}:${options.apiPassword}`, "utf8").toString("base64");
    const { body } = await send({ method: "POST", path: "/token", authorization: `Basic ${basic}` });
    const { token, expires } = (body ?? {}) as { token?: unknown; expires?: unknown };
    if (typeof token !== "string" || token === "") {
      throw new MiCorreoError("UNEXPECTED", "MiCorreo no devolvió un token.");
    }
    const vence = parseMiCorreoExpires(expires)?.getTime() ?? null;
    // SUPUESTO: un vencimiento ilegible o ya pasado (zona horaria distinta de la supuesta)
    // se trata como "dura 10 minutos", para no pedir un token nuevo en cada llamada.
    const expiresAt =
      vence !== null && vence - TOKEN_MARGIN_MS > ahora ? vence : ahora + TOKEN_FALLBACK_TTL_MS;
    tokenCache.set(cacheKey, { token, expiresAt });
    return token;
  }

  /**
   * Pedido con Bearer. Si Correo contesta 401 con un token que creíamos vigente, se descarta,
   * se pide otro y se reintenta UNA vez (la referencia recomienda renovar ante un 401).
   */
  async function authed(spec: Omit<RequestSpec, "authorization">): Promise<unknown> {
    const token = await getToken();
    try {
      return (await send({ ...spec, authorization: `Bearer ${token}` })).body;
    } catch (error) {
      if (!(error instanceof MiCorreoError) || error.status !== 401) throw error;
      tokenCache.delete(cacheKey);
      const nuevo = await getToken();
      return (await send({ ...spec, authorization: `Bearer ${nuevo}` })).body;
    }
  }

  async function validateUser(email: string, password: string): Promise<{ customerId: string }> {
    const body = await authed({ method: "POST", path: "/users/validate", body: { email, password } });
    const raw = (body as { customerId?: unknown } | null)?.customerId;
    // El `customerId` es texto de 10 dígitos con ceros a la izquierda ("0090000025").
    // SUPUESTO: si llegara como número, se le devuelven los ceros perdidos.
    const customerId =
      typeof raw === "string" && raw.trim() !== ""
        ? raw.trim()
        : typeof raw === "number" && Number.isInteger(raw) && raw >= 0
          ? String(raw).padStart(10, "0")
          : null;
    if (!customerId) throw new MiCorreoError("UNEXPECTED", "MiCorreo no devolvió el customerId.");
    return { customerId };
  }

  async function rates(input: MiCorreoRatesInput): Promise<MiCorreoRate[]> {
    // "All fields of the dimensions object are integer values": se redondea hacia arriba
    // para no declarar un paquete más chico que el real.
    const d = input.dimensions;
    const pedido = {
      customerId: input.customerId,
      postalCodeOrigin: input.postalCodeOrigin,
      postalCodeDestination: input.postalCodeDestination,
      // Sin `deliveredType`, MiCorreo cotiza domicilio y sucursal en el mismo pedido.
      ...(input.deliveredType ? { deliveredType: input.deliveredType } : {}),
      dimensions: {
        weight: Math.ceil(d.weight),
        height: Math.ceil(d.height),
        width: Math.ceil(d.width),
        length: Math.ceil(d.length),
      },
    };
    const body = await authed({ method: "POST", path: "/rates", body: pedido });
    const lista = (body as { rates?: unknown } | null)?.rates;
    if (!Array.isArray(lista)) {
      throw new MiCorreoError("UNEXPECTED", "MiCorreo devolvió una cotización sin tarifas.");
    }

    const resultado: MiCorreoRate[] = [];
    for (const item of lista) {
      if (!item || typeof item !== "object") continue;
      const r = item as { deliveredType?: unknown; productName?: unknown; productType?: unknown; price?: unknown };
      // SUPUESTO: puede haber otros productos; sólo interesan las modalidades conocidas.
      if (r.deliveredType !== "D" && r.deliveredType !== "S") continue;
      const priceMinor = parseMiCorreoPriceToMinor(r.price);
      if (priceMinor === null) {
        // Nunca se vende un envío con un precio que no entendimos (E14).
        throw new MiCorreoError("UNEXPECTED", "MiCorreo devolvió un precio inválido.");
      }
      const productName =
        typeof r.productName === "string" && r.productName.trim() !== ""
          ? r.productName.trim()
          : typeof r.productType === "string"
            ? r.productType
            : "";
      resultado.push({ deliveredType: r.deliveredType, productName, priceMinor, raw: item });
    }
    return resultado;
  }

  async function agencies(input: { customerId: string; provinceCode: string }): Promise<MiCorreoAgency[]> {
    // Es un GET con los parámetros en la query (el `curl` de la referencia usa
    // `--data-urlencode` sin `-G`, que es un error del documento).
    const body = await authed({
      method: "GET",
      path: "/agencies",
      query: { customerId: input.customerId, provinceCode: input.provinceCode },
    });
    // SUPUESTO: la referencia muestra un arreglo; por las dudas se acepta `{ agencies: [...] }`.
    const lista = Array.isArray(body)
      ? body
      : Array.isArray((body as { agencies?: unknown } | null)?.agencies)
        ? ((body as { agencies: unknown[] }).agencies)
        : null;
    if (!lista) throw new MiCorreoError("UNEXPECTED", "MiCorreo devolvió una lista de sucursales ilegible.");

    const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
    const resultado: MiCorreoAgency[] = [];
    for (const item of lista) {
      if (!item || typeof item !== "object") continue;
      const a = item as {
        code?: unknown;
        name?: unknown;
        status?: unknown;
        services?: { pickupAvailability?: unknown } | null;
        location?: { address?: Record<string, unknown> | null } | null;
      };
      // El `code` ("B0107") es lo que después va en `shipping.agency` de `/shipping/import`.
      const id = texto(a.code);
      if (!id) continue;
      // SUPUESTO: sin `status` se asume activa; con otro valor que "ACTIVE", se descarta.
      if (a.status !== undefined && a.status !== "ACTIVE") continue;
      // El comprador va a RETIRAR ahí: si Correo dice explícitamente que no entrega, no sirve.
      if (a.services?.pickupAvailability === false) continue;
      const dir = a.location?.address ?? {};
      resultado.push({
        id,
        name: texto(a.name) || id,
        address: [texto(dir.streetName), texto(dir.streetNumber)].filter(Boolean).join(" "),
        // SUPUESTO: `locality` ("Monte Grande") es lo que el comprador reconoce; `city` es el
        // partido ("Esteban Echeverria"). Se prefiere la localidad.
        city: texto(dir.locality) || texto(dir.city),
        postalCode: texto(dir.postalCode),
      });
    }
    return resultado;
  }

  return { getToken, validateUser, rates, agencies };
}
