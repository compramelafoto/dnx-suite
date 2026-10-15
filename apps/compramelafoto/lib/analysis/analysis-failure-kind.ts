/**
 * De quién es la culpa cuando falla el análisis de una foto.
 *
 * La distinción no es académica: decide si la foto se da por perdida o si se vuelve a
 * intentar. Un trabajo que pasa a `ERROR` **no se vuelve a tomar nunca** —la cola sólo
 * reclama los `PENDING`—, así que clasificar mal hacia "la foto está rota" borra el
 * análisis de esa foto para siempre.
 *
 * **Lo que pasó el 7 de octubre de 2026.** La cuenta de AWS se quedó sin credencial
 * válida y Rekognition empezó a contestar *"The security token included in the request is
 * invalid."*. El clasificador anterior buscaba la palabra `invalid` en cualquier parte del
 * mensaje para decidir que la imagen no se podía decodificar. Resultado: 2233 fotos de
 * álbumes con pedidos pagados quedaron marcadas como rotas en el **primer** intento, sin
 * reintento posible, y "buscar mi cara" dejó de encontrarlas.
 *
 * De ahí las dos reglas de este módulo:
 *
 * 1. Lo de infraestructura se reconoce **antes** que lo de la imagen. Son mensajes con
 *    nombre propio (`UnrecognizedClientException`, `ThrottlingException`, `ECONNRESET`) y
 *    no se confunden.
 * 2. Para dar una foto por rota ya no alcanza una palabra genérica como `invalid`: tiene
 *    que haber algo de imagen en el mensaje. Ante la duda se reintenta, porque reintentar
 *    de más cuesta unos centavos y reintentar de menos cuesta la foto.
 */

export type FailureKind =
  /** La foto no se puede decodificar. Reintentar no la va a arreglar. */
  | "PHOTO"
  /** Nosotros, AWS o la red. La foto está bien; hay que volver más tarde. */
  | "INFRASTRUCTURE"
  /** No se sabe. Se reintenta un par de veces y después se deja. */
  | "UNKNOWN";

/** Credenciales, permisos, cuenta, cupo, red y caídas del servicio. */
const INFRASTRUCTURE = [
  // Credenciales y permisos.
  "security token",
  "unrecognizedclient",
  "expiredtoken",
  "invalidsignature",
  "incomplete signature",
  "signature expired",
  "accessdenied",
  "not authorized",
  "credential",
  // Cuenta: lo que contesta AWS cuando está suspendida o sin suscripción.
  "subscriptionrequired",
  "optinrequired",
  "accountproblem",
  // Cupo.
  "throttl",
  "rate exceeded",
  "toomanyrequests",
  "provisionedthroughput",
  "slowdown",
  "limitexceeded",
  // El servicio.
  "serviceunavailable",
  "internalfailure",
  "internalservererror",
  "service is unavailable",
  // La red.
  "econnreset",
  "econnrefused",
  "etimedout",
  "enotfound",
  "eai_again",
  "epipe",
  "socket hang up",
  "socket connection timeout",
  "network error",
  "request timeout",
];

/** Mensajes que sólo puede dar una imagen ilegible. */
const PHOTO = [
  "decoder",
  "corrupt",
  "unsupported image",
  "formato no soportado",
  "imagen inválida",
  "imagen invalida",
  "sin dimensiones",
  "vipsjpeg",
  "vipspng",
  "pngload",
  "jpegload",
  "heifload",
  "no decode delegate",
  "premature end",
  "not a jpeg",
  "unsupported image format",
];

/**
 * Palabras genéricas que condenan a la foto **sólo** si el mensaje habla de una imagen.
 *
 * `invalid` es justo la que estaba en el mensaje de la credencial vencida.
 */
const GENERICAS = ["invalid", "unsupported", "malformed"];
const DE_IMAGEN = [
  "jpeg",
  "jpg",
  "png",
  "webp",
  "heic",
  "heif",
  "tiff",
  "image",
  "imagen",
  "foto",
  "buffer",
  "pixel",
  "sos",
];

const contiene = (texto: string, agujas: string[]) => agujas.some((a) => texto.includes(a));

export function analysisFailureKind(message: string | null | undefined): FailureKind {
  const texto = (message ?? "").toLowerCase();
  if (!texto.trim()) return "UNKNOWN";

  // Primero infraestructura: son los mensajes con nombre propio y no se confunden.
  if (contiene(texto, INFRASTRUCTURE)) return "INFRASTRUCTURE";

  if (contiene(texto, PHOTO)) return "PHOTO";
  if (contiene(texto, GENERICAS) && contiene(texto, DE_IMAGEN)) return "PHOTO";

  return "UNKNOWN";
}

/** Los diez minutos que esperaba la cola antes de que existiera este módulo. */
export const BASE_RETRY_MS = 10 * 60 * 1000;

/**
 * Media hora cuando la culpa es de afuera.
 *
 * No crece con cada intento a propósito: para crecer necesitaría un contador, y el único
 * que hay —`attempts`— es el presupuesto de intentos de la foto. Usarlo para las dos cosas
 * hace que, después de una caída larga, el primer error de verdad lo agote de entrada.
 *
 * Media hora además es nada al lado de lo que tarda la cola en drenar miles de fotos de a
 * poco por cron. Lo que importa es que vuelva sola.
 */
export const INFRASTRUCTURE_RETRY_MS = 30 * 60 * 1000;

/** Cuánto esperar antes del próximo intento. */
export function retryDelayMs(kind: FailureKind): number {
  return kind === "INFRASTRUCTURE" ? INFRASTRUCTURE_RETRY_MS : BASE_RETRY_MS;
}
