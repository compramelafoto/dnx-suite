import { NextResponse } from "next/server";
import { rechazoDeLlave } from "@/lib/llave-de-servicio";
import { mirarLaSalud } from "@/lib/salud/mirar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lo mismo que `/panel/salud`, en JSON.
 *
 * Existe porque la pantalla necesita un usuario administrador y a las tres de la mañana
 * puede no haber ninguno a mano. Con la llave de servicio, desde una terminal, sale igual.
 *
 * También sirve para colgarle un chequeo externo: el semáforo viene en la primera línea.
 */
export async function GET(req: Request) {
  const rechazo = rechazoDeLlave(req);
  if (rechazo) return rechazo;

  const salud = await mirarLaSalud();

  // El estado va también en el código HTTP para que un monitor externo no tenga que
  // interpretar el cuerpo: 200 si está bien, 503 si algo dejó de correr.
  return NextResponse.json(salud, { status: salud.semaforo === "caido" ? 503 : 200 });
}
