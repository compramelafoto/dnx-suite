import { createHash } from "node:crypto";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { AndreaniError } from "./errors";

/**
 * Cliente de la API directa de Andreani (`apis.andreani.com`), para cotizar envíos y listar
 * sucursales. Mismo diseño que `../correo-argentino/client.ts`.
 *
 * Referencia: `docs/integraciones/andreani-api.md`, que separa lo OFICIAL de lo INFERIDO.
 * Donde la referencia no alcanza, se parsea a la defensiva y el supuesto queda anotado con
 * "SUPUESTO" para revisarlo contra QA con credenciales reales.
 *
 * Sin base y sin `server-only`: la red entra por `fetchImpl` (por defecto el `fetch` global)
 * para que los tests nunca salgan a internet. Igual, sólo se usa desde el servidor: las
 * credenciales no pueden llegar al navegador.
 *
 * Logs: este módulo no loguea nada. Quien lo use loguea sólo `kind` y `status` del error.
 */

export type AndreaniEnv = "QA" | "PROD";

export const ANDREANI_BASE_URLS: Record<AndreaniEnv, string> = {
  QA: "https://apisqa.andreani.com",
  PROD: "https://apis.andreani.com",
};

const TIMEOUT_MS = 5_000;
/** Se renueva el token este tiempo antes de que venza. */
const TOKEN_MARGIN_MS = 60_000;
/**
 * [OFICIAL] "tienen una vigencia de 24 hs". El login no informa el vencimiento (sólo manda
 * el token en un encabezado), así que se cuenta desde que se pidió.
 */
const TOKEN_TTL_MS = 24 * 3600_000;
/** El texto de Andreani que se conserva en los errores, como mucho. */
const MAX_MESSAGE_CHARS = 300;
const TOKEN_HEADER = "x-authorization-token";

export type AndreaniPackage = {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** Valor declarado SIN impuestos, en centavos (para el seguro de distribución). */
  declaredValueMinor: number;
};

export type AndreaniQuoteInput = {
  clientCode: string;
  /** El contrato define la modalidad: el de domicilio o el de sucursal de la institución. */
  contract: string;
  postalCodeDestination: string;
  /** Sucursal donde se impone el paquete. Opcional. */
  originBranch?: string | null;
  packages: AndreaniPackage[];
};

export type AndreaniQuote = { priceMinor: number; raw: unknown };

export type AndreaniBranch = {
  /** `id` numérico de Andreani como texto; es lo que va en `destino.sucursal.id` de la orden. */
  id: string;
  /** Código corto ("SFN"). */
  code: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
};

export type AndreaniClient = {
  /** Clave de la caché del token: ambiente + usuario + SHA-256 de la clave. */
  readonly cacheKey: string;
  /** `fresh: true` ignora la caché (para validar credenciales recién cargadas). */
  getToken(options?: { fresh?: boolean }): Promise<string>;
  quote(input: AndreaniQuoteInput): Promise<AndreaniQuote>;
  branches(input: { postalCode: string }): Promise<AndreaniBranch[]>;
};

export type AndreaniClientOptions = {
  env: AndreaniEnv;
  user: string;
  password: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

// --- Caché del token -----------------------------------------------------------------------

/**
 * Por instancia del servidor, compartida entre clientes. La clave es ambiente + usuario +
 * SHA-256 de la contraseña (nunca la contraseña en sí): si la clave no participara, otra
 * institución con el mismo usuario y cualquier contraseña usaría el token de la primera sin
 * que Andreani la valide nunca.
 */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
/**
 * Logins en curso, por la misma clave: si varias cotizaciones salen juntas sin token, comparten
 * un único `/login` en vez de pedir uno cada una.
 */
const loginsEnCurso = new Map<string, Promise<string>>();

export function resetAndreaniTokenCacheForTests(): void {
  tokenCache.clear();
  loginsEnCurso.clear();
}

// --- Precio --------------------------------------------------------------------------------

/**
 * `tarifaConIva.total` → centavos enteros.
 *
 * [OFICIAL] llega como texto con punto decimal ("7041.21"). SUPUESTOS (a la defensiva): puede
 * llegar como número; o como texto con coma decimal ("7041,21"). Si hay punto Y coma, el
 * separador que aparece último es el decimal y el otro es de miles ("7.041,21" o "7,041.21").
 * Si un mismo separador se repite y no hay otro, es de miles ("1.234.567"). Más de dos
 * decimales se recortan (mismo criterio que `lib/membership/money.ts`).
 *
 * Devuelve `null` para lo que no es un importe válido (negativo, vacío, no numérico).
 */
export function parseAndreaniPriceToMinor(value: unknown): number | null {
  let texto: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    // `toFixed` evita la notación exponencial y el ruido de punto flotante.
    texto = value.toFixed(6);
  } else if (typeof value === "string") {
    const limpio = value.trim();
    const ultimoPunto = limpio.lastIndexOf(".");
    const ultimaComa = limpio.lastIndexOf(",");
    let decimal: "." | "," | null;
    if (ultimoPunto >= 0 && ultimaComa >= 0) decimal = ultimoPunto > ultimaComa ? "." : ",";
    else if (ultimoPunto >= 0) decimal = limpio.indexOf(".") === ultimoPunto ? "." : null;
    else if (ultimaComa >= 0) decimal = limpio.indexOf(",") === ultimaComa ? "," : null;
    else decimal = null;
    const miles = decimal === "." ? "," : decimal === "," ? "." : /[.,]/;
    texto = limpio.split(miles).join("");
    if (decimal === ",") texto = texto.replace(",", ".");
  } else {
    return null;
  }
  if (!/^\d+(\.\d+)?$/.test(texto)) return null;
  return decimalArsToMinor(texto);
}

// --- HTTP ----------------------------------------------------------------------------------

function parseJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

/**
 * [OFICIAL+LIVE] Andreani contesta con ProblemDetails (`{type,title,detail,status,errors}`) en
 * la tarifa y con `{message}` en el login. Se prefiere `detail` (lo más específico), después
 * `title`, después `message`.
 */
function mensajeDeAndreani(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { detail?: unknown; title?: unknown; message?: unknown };
  for (const candidato of [b.detail, b.title, b.message]) {
    if (typeof candidato === "string" && candidato.trim() !== "") {
      return candidato.trim().slice(0, MAX_MESSAGE_CHARS);
    }
  }
  return null;
}

function errorPorStatus(status: number, body: unknown): AndreaniError {
  // Sólo el 401 (después del único reintento) es una credencial que dejó de valer. Un 403 puede
  // ser el firewall (Cloudflare) o un permiso de la cuenta: no se marca para reconectar.
  if (status === 401) return new AndreaniError("AUTH", "Andreani rechazó las credenciales.", status);
  if (status === 429) {
    return new AndreaniError("RATE_LIMIT", "Andreani pidió esperar antes de reintentar.", status);
  }
  if ([400, 402, 403, 404, 409].includes(status)) {
    const mensaje = mensajeDeAndreani(body);
    return new AndreaniError(
      "BUSINESS",
      mensaje ? `Andreani: ${mensaje}` : "Andreani rechazó el pedido.",
      status,
    );
  }
  return new AndreaniError("UNEXPECTED", `Andreani respondió ${status}.`, status);
}

type RequestSpec = {
  path: string;
  query?: [string, string][];
  headers: Record<string, string>;
};

type RawResponse = { status: number; headers: Headers; texto: string };

function esPositivoFinito(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Kilos como texto con punto decimal, hasta 3 decimales, redondeando hacia arriba (gramos). */
function kilosTexto(kg: number): string {
  const gramos = Math.ceil(Math.round(kg * 1e6) / 1e3);
  return String(gramos / 1000);
}

export function createAndreaniClient(options: AndreaniClientOptions): AndreaniClient {
  const baseUrl = ANDREANI_BASE_URLS[options.env];
  if (!baseUrl) throw new AndreaniError("UNEXPECTED", "Ambiente de Andreani desconocido.");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const passwordHash = createHash("sha256").update(options.password, "utf8").digest("hex");
  const cacheKey = `${options.env}:${options.user}:${passwordHash}`;

  /** Hace el pedido y devuelve la respuesta cruda. Lanza sólo por red/timeout. */
  async function send(spec: RequestSpec): Promise<RawResponse> {
    const url = new URL(`${baseUrl}${spec.path}`);
    for (const [k, v] of spec.query ?? []) url.searchParams.append(k, v);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", ...spec.headers },
        signal: controller.signal,
        cache: "no-store",
      });
      const texto = await response.text();
      return { status: response.status, headers: response.headers, texto };
    } catch {
      // No se propaga el error original: podría arrastrar la URL o encabezados.
      throw new AndreaniError(
        "NETWORK",
        controller.signal.aborted ? "Andreani no respondió a tiempo." : "No se pudo conectar con Andreani.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Respuesta 2xx con JSON, o el error tipado que corresponde. */
  function jsonOrThrow(r: RawResponse): unknown {
    const body = r.texto.trim() === "" ? undefined : parseJson(r.texto);
    if (r.status < 200 || r.status >= 300) throw errorPorStatus(r.status, body);
    if (body === undefined) {
      throw new AndreaniError("UNEXPECTED", "Andreani devolvió una respuesta ilegible.", r.status);
    }
    return body;
  }

  function tokenEnCache(): string | null {
    const cached = tokenCache.get(cacheKey);
    if (cached && now().getTime() < cached.expiresAt - TOKEN_MARGIN_MS) return cached.token;
    return null;
  }

  async function login(): Promise<string> {
    tokenCache.delete(cacheKey);
    const basic = Buffer.from(`${options.user}:${options.password}`, "utf8").toString("base64");
    const r = await send({ path: "/login", headers: { Authorization: `Basic ${basic}` } });
    if (r.status < 200 || r.status >= 300) {
      throw errorPorStatus(r.status, r.texto.trim() === "" ? undefined : parseJson(r.texto));
    }
    // [OFICIAL+TERCEROS] el token viene en el ENCABEZADO de respuesta. El cuerpo del login no
    // está documentado. SUPUESTO: si el encabezado faltara y el cuerpo trajera `token`, sirve.
    let token = r.headers.get(TOKEN_HEADER)?.trim() ?? "";
    if (!token) {
      const body = parseJson(r.texto) as { token?: unknown } | undefined;
      if (body && typeof body === "object" && typeof body.token === "string") token = body.token.trim();
    }
    if (!token) throw new AndreaniError("UNEXPECTED", "Andreani no devolvió un token.", r.status);
    tokenCache.set(cacheKey, { token, expiresAt: now().getTime() + TOKEN_TTL_MS });
    return token;
  }

  /** Un login por clave a la vez: los que llegan mientras hay uno en curso lo esperan. */
  function loginCompartido(): Promise<string> {
    const enCurso = loginsEnCurso.get(cacheKey);
    if (enCurso) return enCurso;
    const promesa = login().finally(() => loginsEnCurso.delete(cacheKey));
    loginsEnCurso.set(cacheKey, promesa);
    return promesa;
  }

  /** El token y si salió de la caché (o sea, si pudo haber vencido antes de tiempo). */
  async function tokenConOrigen(): Promise<{ token: string; fromCache: boolean }> {
    const cached = tokenEnCache();
    if (cached) return { token: cached, fromCache: true };
    return { token: await loginCompartido(), fromCache: false };
  }

  async function getToken(tokenOptions?: { fresh?: boolean }): Promise<string> {
    if (tokenOptions?.fresh) return loginCompartido();
    return (await tokenConOrigen()).token;
  }

  /**
   * Pedido con token.
   *
   * [LIVE] Andreani contesta 400 (no 401) a la tarifa con un token inválido, así que un 400 no
   * distingue "token vencido" de "dato mal". Regla: si el token salió de la CACHÉ y la respuesta
   * es 400 o 401, se descarta, se pide uno nuevo y se reintenta UNA vez. Con un token recién
   * pedido no se reintenta: 400 es BUSINESS y 401 es AUTH. Así un token invalidado antes de las
   * 24 h no deja a la tienda cotizando mal todo el día, y un 401 real termina en AUTH (que
   * quien llama traduce en "hay que reconectar").
   *
   * Costo aceptado: un 400 de negocio (p. ej. un CP que Andreani no atiende) con token en caché
   * cuesta un login extra.
   */
  async function authed(spec: Omit<RequestSpec, "headers">): Promise<unknown> {
    const { token, fromCache } = await tokenConOrigen();
    const primera = await send({ ...spec, headers: { [TOKEN_HEADER]: token } });
    if (!fromCache || (primera.status !== 400 && primera.status !== 401)) return jsonOrThrow(primera);
    // Si otro pedido ya lo renovó mientras tanto, se usa ese; si no, login (compartido).
    const vigente = tokenEnCache();
    const nuevo = vigente && vigente !== token ? vigente : await loginCompartido();
    return jsonOrThrow(await send({ ...spec, headers: { [TOKEN_HEADER]: nuevo } }));
  }

  async function quote(input: AndreaniQuoteInput): Promise<AndreaniQuote> {
    if (!Array.isArray(input.packages) || input.packages.length === 0) {
      throw new AndreaniError("BUSINESS", "No hay bultos para cotizar.");
    }
    const query: [string, string][] = [
      ["cpDestino", input.postalCodeDestination],
      ["contrato", input.contract],
      ["cliente", input.clientCode],
    ];
    if (input.originBranch) query.push(["sucursalOrigen", input.originBranch]);

    input.packages.forEach((p, i) => {
      if (
        ![p.weightKg, p.lengthCm, p.widthCm, p.heightCm].every(esPositivoFinito) ||
        !Number.isInteger(p.declaredValueMinor) ||
        p.declaredValueMinor < 0
      ) {
        throw new AndreaniError("BUSINESS", "Un bulto tiene medidas, peso o valor inválidos.");
      }
      // Medidas en cm enteros hacia arriba: nunca declarar un paquete más chico que el real.
      const largo = Math.ceil(p.lengthCm);
      const ancho = Math.ceil(p.widthCm);
      const alto = Math.ceil(p.heightCm);
      const b = `bultos[${i}]`;
      query.push(
        [`${b}[kilos]`, kilosTexto(p.weightKg)],
        [`${b}[largoCm]`, String(largo)],
        [`${b}[anchoCm]`, String(ancho)],
        [`${b}[altoCm]`, String(alto)],
        // [OFICIAL] `volumen` es OBLIGATORIO y va en cm³.
        [`${b}[volumen]`, String(largo * ancho * alto)],
        // [OFICIAL] valor sin impuestos, opcional. SUPUESTO: pesos con punto decimal ("1200.00";
        // el ejemplo oficial usa "1200"). Se manda aunque sea 0 para que la tarifa sea estable.
        [`${b}[valorDeclarado]`, minorToDecimalString(p.declaredValueMinor)],
      );
    });

    const body = await authed({ path: "/v1/tarifas", query });
    // [OFICIAL] lo que se cobra es `tarifaConIva.total`. SUPUESTO (pendiente de QA): con varios
    // bultos sigue siendo un objeto con el total, no un arreglo.
    const total = (body as { tarifaConIva?: { total?: unknown } | null } | null)?.tarifaConIva?.total;
    const priceMinor = parseAndreaniPriceToMinor(total);
    if (priceMinor === null || priceMinor <= 0) {
      // Nunca se vende un envío con un precio que no entendimos, ni a $0 por accidente.
      throw new AndreaniError("UNEXPECTED", "Andreani devolvió un precio inválido.");
    }
    return { priceMinor, raw: body };
  }

  async function branches(input: { postalCode: string }): Promise<AndreaniBranch[]> {
    // [OFICIAL+LIVE] el listado es público, sin token. Si hay uno vigente en caché se manda
    // igual (no se hace login para esto: unas credenciales malas no tienen que dejar a la
    // tienda sin sucursales).
    const query: [string, string][] = [
      ["codigoPostal", input.postalCode],
      ["canal", "B2C"],
    ];
    const token = tokenEnCache();
    let r = await send({ path: "/v2/sucursales", query, headers: token ? { [TOKEN_HEADER]: token } : {} });
    if (r.status === 401 && token) {
      // Si el token sobra y además está vencido, se pregunta sin él.
      tokenCache.delete(cacheKey);
      r = await send({ path: "/v2/sucursales", query, headers: {} });
    }
    // [OFICIAL] "No se encuentran sucursales para los filtros ingresados" llega como 404.
    if (r.status === 404) return [];
    const body = jsonOrThrow(r);

    // [LIVE] es un arreglo. SUPUESTO: por las dudas se acepta envuelto en `sucursales`/`data`.
    const envuelto = body as { sucursales?: unknown; data?: unknown } | null;
    const lista = Array.isArray(body)
      ? body
      : Array.isArray(envuelto?.sucursales)
        ? (envuelto.sucursales as unknown[])
        : Array.isArray(envuelto?.data)
          ? (envuelto.data as unknown[])
          : null;
    if (!lista) throw new AndreaniError("UNEXPECTED", "Andreani devolvió una lista de sucursales ilegible.");

    const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
    const verdadero = (v: unknown) =>
      v === true || v === 1 || (typeof v === "string" && ["true", "si", "sí", "1"].includes(v.trim().toLowerCase()));

    const resultado: AndreaniBranch[] = [];
    for (const item of lista) {
      if (!item || typeof item !== "object") continue;
      const s = item as {
        id?: unknown;
        codigo?: unknown;
        descripcion?: unknown;
        direccion?: Record<string, unknown> | null;
        datosAdicionales?: { entregaEnvios?: unknown } | null;
      };
      // El comprador va a RETIRAR ahí: sólo las que Andreani marca explícitamente como que
      // entregan envíos. Sin el dato, se descarta (mejor una sucursal menos que una que no entrega).
      if (!verdadero(s.datosAdicionales?.entregaEnvios)) continue;
      const code = texto(s.codigo);
      const id = texto(s.id) || code;
      if (!id) continue;
      const dir = s.direccion ?? {};
      resultado.push({
        id,
        code,
        name: texto(s.descripcion) || code || id,
        address: [texto(dir.calle), texto(dir.numero)].filter(Boolean).join(" "),
        postalCode: texto(dir.codigoPostal),
        city: texto(dir.localidad),
      });
    }
    return resultado;
  }

  return { cacheKey, getToken, quote, branches };
}
