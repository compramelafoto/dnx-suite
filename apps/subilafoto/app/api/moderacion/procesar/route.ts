import { NextResponse } from "next/server";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { moderarPendientes } from "@/lib/moderacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Red de seguridad de la moderación.
 *
 * El camino normal es otro: la foto se modera apenas el invitado confirma la
 * subida, con `after()`, sin que él tenga que esperar. Esta ruta recoge las que
 * se perdieron —la función se cortó, el proceso murió, Amazon estaba caído— y
 * las vuelve a intentar.
 *
 * Sin ella, una foto que falló una vez se queda en `PROCESSING` para siempre y
 * nadie se entera hasta que el cliente pregunta por qué no salió en la pantalla.
 *
 * Protegida con `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: Request) {
  // Sin secreto configurado no se abre: es preferible que el cron falle ruidosamente a
  // dejar una ruta que cualquiera puede disparar.
  const rechazo = rechazoDeLlave(req);
  if (rechazo) return rechazo;

  const arranque = Date.now();
  const resumen = await moderarPendientes();

  return NextResponse.json({ ...resumen, msTotal: Date.now() - arranque });
}
