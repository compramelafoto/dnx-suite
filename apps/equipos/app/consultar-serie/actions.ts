"use server";

import { requireLevel } from "@/lib/guards";
import { lookupSerial, type SerialLookupResult } from "@/lib/serie/consultar";

export type ConsultaEstado = SerialLookupResult | null;

/**
 * Consulta una serie. Vuelve a exigir identidad verificada (nunca se confía en el cliente) y
 * devuelve el resultado en la misma respuesta: no pasa por la dirección, así nadie puede armar un
 * enlace que muestre un resultado.
 */
export async function consultarSerie(
  _previo: ConsultaEstado,
  formData: FormData,
): Promise<ConsultaEstado> {
  const user = await requireLevel("identidad", "/consultar-serie");
  const raw = formData.get("serie");
  return lookupSerial(user.id, typeof raw === "string" ? raw.slice(0, 100) : "");
}
