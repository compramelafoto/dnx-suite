import "server-only";
import { prisma } from "@repo/db";
import type { PlantillaInicial } from "@/lib/plantillas/semillas";

/**
 * Plantillas iniciales del envío de presupuestos (tipo PRESUPUESTO, etapa 2). Reemplazan, para el
 * presupuesto, a "Propuesta para tu evento" de 0.6, que pedía pegar a mano la propuesta: acá va
 * el enlace real (`[presupuesto_enlace]`). Sólo usan variables válidas para PRESUPUESTO; las que
 * pueden faltar van en bloques `[si:…]`. Sin textos para completar a mano: se envían tal cual.
 */
export const PLANTILLAS_PRESUPUESTO: readonly PlantillaInicial[] = [
  {
    canal: "EMAIL",
    tipo: "PRESUPUESTO",
    nombre: "Te enviamos tu presupuesto",
    asunto: "Tu presupuesto[si:presupuesto_numero] N° [presupuesto_numero][/si][si:consulta_fecha] para el [consulta_fecha][/si]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Muchas gracias por tu consulta! Armamos el presupuesto pensado para lo que nos contaste[si:consulta_fecha] para tu evento del [consulta_fecha][/si][si:consulta_lugar] en [consulta_lugar][/si].

Lo podés ver completo en este enlace:

[presupuesto_enlace]

[si:presupuesto_total]El total es de [presupuesto_total][/si][si:presupuesto_vence] y vale hasta el [presupuesto_vence][/si]. Desde el mismo enlace lo podés aceptar o descargar en PDF.

Si te queda alguna duda o querés ajustar algo, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si]. Con gusto lo adaptamos.

[firma]`,
  },
  {
    canal: "WHATSAPP",
    tipo: "PRESUPUESTO",
    nombre: "Tu presupuesto",
    asunto: null,
    cuerpo: `¡Hola[si:nombre], [nombre][/si]! [si:organizacion]Te escribimos de [organizacion]. [/si]Te mandamos el presupuesto[si:presupuesto_numero] N° [presupuesto_numero][/si] para tu evento[si:consulta_fecha] del [consulta_fecha][/si]:

[presupuesto_enlace]

[si:presupuesto_vence]Vale hasta el [presupuesto_vence]. [/si]Desde ahí lo podés aceptar o descargar en PDF. Cualquier duda, escribinos por acá.`,
  },
];

/**
 * Crea, una sola vez por organización, las plantillas de PRESUPUESTO. La marca de "ya sembrado"
 * es que exista alguna plantilla de ese tipo (también archivada): las que alguien borró del todo
 * vuelven sólo si no queda ninguna. Idempotente: conteo afuera y re-chequeo adentro.
 */
export async function asegurarPlantillasPresupuesto(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeMessageTemplate.count({ where: { workspaceId, entityType: "PRESUPUESTO" } })) > 0) return;
  await prisma.$transaction(async (tx) => {
    // Dos pestañas a la vez: el candado por organización las pone en fila y la segunda ya cuenta las de la primera.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-plantillas-presupuesto:${workspaceId}`}))`;
    if ((await tx.fotofficeMessageTemplate.count({ where: { workspaceId, entityType: "PRESUPUESTO" } })) > 0) return;
    const ultimos = await tx.fotofficeMessageTemplate.findMany({
      where: { workspaceId, systemKey: null },
      select: { channel: true, order: true },
    });
    const siguiente = (canal: string) => Math.max(-1, ...ultimos.filter((u) => u.channel === canal).map((u) => u.order)) + 1;
    await tx.fotofficeMessageTemplate.createMany({
      data: PLANTILLAS_PRESUPUESTO.map((p) => ({
        workspaceId, channel: p.canal, entityType: p.tipo, name: p.nombre, subject: p.asunto, body: p.cuerpo, order: siguiente(p.canal),
      })),
    });
  });
}
