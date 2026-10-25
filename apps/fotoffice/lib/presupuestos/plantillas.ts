import "server-only";
import { prisma } from "@repo/db";
import { AUTOMATICOS } from "@/lib/plantillas/definiciones";
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
 * es que exista alguna plantilla común de ese tipo (también archivada; la automática del
 * seguimiento no cuenta): las que alguien borró del todo vuelven sólo si no queda ninguna. Idempotente: conteo afuera y re-chequeo adentro.
 */
export async function asegurarPlantillasPresupuesto(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeMessageTemplate.count({ where: { workspaceId, entityType: "PRESUPUESTO", systemKey: null } })) > 0) return;
  await prisma.$transaction(async (tx) => {
    // Dos pestañas a la vez: el candado por organización las pone en fila y la segunda ya cuenta las de la primera.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-plantillas-presupuesto:${workspaceId}`}))`;
    if ((await tx.fotofficeMessageTemplate.count({ where: { workspaceId, entityType: "PRESUPUESTO", systemKey: null } })) > 0) return;
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

/** Texto inicial del seguimiento automático (Entrega B). Sólo variables válidas para PRESUPUESTO. */
export const SEGUIMIENTO_INICIAL = {
  asunto: "¿Pudiste ver el presupuesto[si:presupuesto_numero] N° [presupuesto_numero][/si]?",
  cuerpo: `Hola[si:nombre], [nombre][/si]:

Hace unos días te mandamos el presupuesto[si:consulta_fecha] para tu evento del [consulta_fecha][/si]. Queríamos saber si lo pudiste ver y si te quedó alguna duda.

Lo podés volver a abrir acá:

[presupuesto_enlace]

[si:presupuesto_vence]Vale hasta el [presupuesto_vence]. [/si]Si querés ajustar algo, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
} as const;

const CLAVE_SEGUIMIENTO = "PRESUPUESTO_SEGUIMIENTO" as const;

/**
 * Crea, una sola vez por organización, la plantilla automática del seguimiento (encendida: el
 * interruptor que manda es el de Configuración → Presupuestos, que nace apagado). Idempotente:
 * conteo afuera y el índice único (workspaceId, systemKey) adentro.
 */
export async function asegurarPlantillaSeguimiento(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeMessageTemplate.count({ where: { workspaceId, systemKey: CLAVE_SEGUIMIENTO } })) > 0) return;
  const def = AUTOMATICOS[CLAVE_SEGUIMIENTO];
  try {
    await prisma.fotofficeMessageTemplate.create({
      data: {
        workspaceId, systemKey: CLAVE_SEGUIMIENTO, channel: def.canal, entityType: def.tipo, name: def.nombre,
        subject: SEGUIMIENTO_INICIAL.asunto, body: SEGUIMIENTO_INICIAL.cuerpo, enabled: true, order: 2,
      },
      select: { id: true },
    });
  } catch (e) {
    // Otra corrida la creó en el mismo instante: el índice único nos frena; da igual.
    if ((e as { code?: unknown })?.code !== "P2002") throw e;
  }
}
