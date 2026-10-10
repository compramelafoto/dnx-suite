import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@repo/db";
import { decodeRoomPass, encodeRoomPass, type RoomPass } from "@repo/muestras";

/**
 * Firma del pase de sala (spec D30): HMAC-SHA256 con la llave de la muestra
 * (`CulturalActivityRoomKey.secret`, 32 bytes al azar en hexadecimal). La llave vive sólo en la
 * base y en este módulo: nunca sale en una consulta pública ni llega al navegador.
 */
const esChoqueUnico = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";
const nuevaLlave = () => randomBytes(32).toString("hex");
/** Una cookie de más de 4 KB el navegador ni la guarda: lo que pase de esto es basura. */
const LARGO_MAXIMO = 4096;
const FIRMA = /^[A-Za-z0-9_-]{43}$/;

function hmac(payload: string, llave: string): Buffer {
  return createHmac("sha256", Buffer.from(llave, "hex")).update(payload, "utf8").digest();
}

/** La llave de la muestra, si ya existe (para leer un pase no hace falta crearla). */
export async function llaveExistente(activityId: string): Promise<string | null> {
  const k = await prisma.culturalActivityRoomKey.findUnique({ where: { activityId }, select: { secret: true } });
  return k?.secret ?? null;
}

/** La llave de la muestra; la primera vez se crea. Dos escaneos a la vez: el índice deja una sola. */
export async function llaveDeMuestra(activityId: string): Promise<string> {
  const ya = await llaveExistente(activityId);
  if (ya) return ya;
  try {
    const k = await prisma.culturalActivityRoomKey.create({ data: { activityId, secret: nuevaLlave() }, select: { secret: true } });
    return k.secret;
  } catch (err) {
    if (!esChoqueUnico(err)) throw err;
    const otra = await llaveExistente(activityId);
    if (!otra) throw err;
    return otra;
  }
}

/** "Cortar los accesos de sala": una llave nueva hace que los pases firmados con la vieja no valgan. */
export async function rotarLlave(activityId: string): Promise<void> {
  const secret = nuevaLlave();
  await prisma.culturalActivityRoomKey.upsert({
    where: { activityId },
    create: { activityId, secret },
    update: { secret, rotatedAt: new Date() },
  });
}

/** `<pase en base64url>.<HMAC-SHA256 en base64url>`. */
export function firmarPase(pase: RoomPass, llave: string): string {
  const payload = encodeRoomPass(pase);
  return `${payload}.${hmac(payload, llave).toString("base64url")}`;
}

/**
 * El pase si la firma es de esta llave; si no, `null`. Primero se verifica la firma (largo fijo y
 * comparación en tiempo constante) y **recién después** se decodifica el contenido: lo que no está
 * firmado por nosotros ni se lee. Nunca lanza. La muestra y el vencimiento los mira `roomPassValid`.
 */
export function leerPase(valor: string | null | undefined, llave: string): RoomPass | null {
  try {
    if (!valor || valor.length > LARGO_MAXIMO || !llave) return null;
    const punto = valor.lastIndexOf(".");
    if (punto <= 0) return null;
    const payload = valor.slice(0, punto);
    const firma = valor.slice(punto + 1);
    if (!FIRMA.test(firma)) return null;
    const recibida = Buffer.from(firma, "base64url");
    const esperada = hmac(payload, llave);
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null;
    return decodeRoomPass(payload);
  } catch {
    return null;
  }
}
