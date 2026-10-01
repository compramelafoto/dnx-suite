import { NextResponse } from "next/server";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { conLatido } from "@/lib/salud/latido";
import { moderarPendientes } from "@/lib/moderacion";
import { generarVariantesRezagadas } from "@/lib/variantes/rezagadas";

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

  /*
    Envuelto en el latido. Deja una fila por cron que responde la única pregunta que
    ninguna otra tabla contesta: si esto sigue corriendo. Un cron que se detiene no
    tira error ni rompe una pantalla — las fotos simplemente dejan de moderarse.

    La tarea devuelve datos pelados y el `NextResponse.json` queda afuera: así lo que
    se anota es el resultado y no un objeto de respuesta vacío.
  */
  const datos = await conLatido("moderacion", async () => {

    const arranque = Date.now();
    const resumen = await moderarPendientes();

    /*
      Y de paso, las fotos ya decididas que se quedaron sin variante. Normalmente no hay
      ninguna. Si la hay, sin esto queda invisible para siempre: nadie vuelve a moderar una
      foto ya decidida, y una foto sin variante no se muestra en ningún lado.
    */
    const variantes = await generarVariantesRezagadas();

    return { ...resumen, variantes, msTotal: Date.now() - arranque };
  });

  return NextResponse.json(datos);
}
