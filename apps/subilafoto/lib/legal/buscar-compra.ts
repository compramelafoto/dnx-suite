import "server-only";

import { prisma } from "@repo/db";

/**
 * Busca a qué compra se refiere una solicitud de arrepentimiento.
 *
 * Quien la escribe no tiene el identificador de la orden: tiene su correo y, con suerte,
 * el código del evento anotado en alguna parte. Esto es lo que hoy se hacía a mano
 * abriendo la base, y es el único trabajo real de resolver una solicitud.
 *
 * **Devuelve candidatas, no una respuesta.** Dos personas pueden compartir un correo y
 * alguien puede escribir mal el código; quien resuelve mira y elige.
 */

export type Candidata = {
  id: string;
  kind: string;
  status: string;
  amountCents: number;
  buyerEmail: string;
  paidAt: Date | null;
  createdAt: Date;
  eventoCode: string | null;
  eventoName: string | null;
  vendedor: string;
  porQue: string;
};

export async function buscarCompras(entrada: {
  email: string;
  referencia: string;
}): Promise<Candidata[]> {
  const referencia = entrada.referencia.trim();

  const filas = await prisma.subilafotoOrder.findMany({
    where: {
      OR: [
        { buyerEmail: { equals: entrada.email, mode: "insensitive" } },
        // El código del evento se escribe en mayúsculas pero nadie lo escribe así.
        { event: { code: { equals: referencia, mode: "insensitive" } } },
        // O directamente el identificador de la orden, si lo pegó del correo.
        { id: referencia },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      kind: true,
      status: true,
      amountCents: true,
      buyerEmail: true,
      paidAt: true,
      createdAt: true,
      event: { select: { code: true, name: true } },
      sellerProfile: { select: { displayName: true } },
    },
  });

  return filas.map((o) => ({
    id: o.id,
    kind: o.kind,
    status: o.status,
    amountCents: o.amountCents,
    buyerEmail: o.buyerEmail,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
    eventoCode: o.event?.code ?? null,
    eventoName: o.event?.name ?? null,
    vendedor: o.sellerProfile.displayName,
    // Por qué apareció: sin esto, una coincidencia por código con otro correo parece un
    // error del buscador en vez de un dato para mirar con atención.
    porQue:
      o.buyerEmail.toLowerCase() === entrada.email.toLowerCase()
        ? "Coincide el correo"
        : o.id === referencia
          ? "Coincide el número de la compra"
          : "Coincide el código del evento",
  }));
}
