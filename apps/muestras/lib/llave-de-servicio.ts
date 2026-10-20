import { createHash, timingSafeEqual } from "node:crypto";

/**
 * La llave que protege las rutas que no tienen usuario: los cron y el diagnóstico.
 *
 * Está en un solo lugar para que cada ruta nueva sin usuario la use tal cual: una regla de
 * seguridad copiada en varias rutas es una regla que en algún momento va a estar mal en una.
 *
 * Sin secreto configurado **no se atiende a nadie**. La alternativa —dejar pasar cuando
 * falta la variable— convierte un olvido de configuración en una puerta abierta.
 */

export type Veredicto = "ok" | "no-autorizado" | "sin-configurar";

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest();

export function revisarLlave(
  encabezado: string | null,
  secreto: string | undefined,
): Veredicto {
  const esperado = secreto?.trim();
  if (!esperado) return "sin-configurar";

  const prefijo = "Bearer ";
  if (!encabezado || !encabezado.startsWith(prefijo)) return "no-autorizado";

  const recibido = encabezado.slice(prefijo.length);
  // Se comparan los SHA-256 de los dos: siempre 32 bytes, así `timingSafeEqual` nunca explota
  // (con el texto crudo, "ñ" y "n" miden lo mismo en caracteres pero no en bytes) y no se
  // filtra ni el largo del secreto.
  return timingSafeEqual(sha256(recibido), sha256(esperado)) ? "ok" : "no-autorizado";
}

/**
 * La respuesta cuando la llave no sirve, o `null` si sirve.
 *
 * Devuelve 503 y no 401 cuando falta la variable: no es que el que llama se equivocó, es
 * que la ruta no está configurada. Confundir las dos manda a buscar el problema al lado
 * equivocado.
 */
export function rechazoDeLlave(req: Request): Response | null {
  const veredicto = revisarLlave(req.headers.get("authorization"), process.env.CRON_SECRET);
  if (veredicto === "sin-configurar") {
    return Response.json({ error: "Falta CRON_SECRET." }, { status: 503 });
  }
  if (veredicto === "no-autorizado") {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  return null;
}
