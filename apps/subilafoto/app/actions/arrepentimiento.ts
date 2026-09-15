"use server";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { hashDeIp } from "@/lib/consentimiento";
import { ipDelPedido } from "@/lib/consentimiento-db";
import { constanciaDesde, revisarSolicitud } from "@/lib/legal/arrepentimiento";

/**
 * Recibe una solicitud de arrepentimiento.
 *
 * **Nunca se rechaza por el plazo.** El artículo 34 da diez días corridos, pero decidir
 * acá que alguien se pasó —con un dato que puede no ser el correcto— es negarle un derecho
 * con una consulta automática. La solicitud entra siempre y la resuelve una persona.
 */

export type EstadoDeArrepentimiento = { error?: string; constancia?: string };

export async function pedirArrepentimientoAction(
  _previo: EstadoDeArrepentimiento,
  formData: FormData,
): Promise<EstadoDeArrepentimiento> {
  const texto = (campo: string) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : "";
  };

  const revision = revisarSolicitud({
    email: texto("email"),
    referencia: texto("referencia"),
    motivo: texto("motivo"),
  });

  if (!revision.ok) return { error: revision.error };

  const creada = await prisma.subilafotoRetractionRequest.create({
    data: {
      reference: revision.datos.referencia,
      email: revision.datos.email,
      reason: revision.datos.motivo,
      ipHash: hashDeIp(ipDelPedido(await headers())),
      // Provisorio: la constancia se deriva del identificador, que todavía no existe.
      receipt: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    select: { id: true, createdAt: true },
  });

  const constancia = constanciaDesde(creada.id, creada.createdAt);
  await prisma.subilafotoRetractionRequest.update({
    where: { id: creada.id },
    data: { receipt: constancia },
  });

  return { constancia };
}
