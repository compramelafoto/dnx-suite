import "server-only";
import { prisma } from "@repo/db";
import { AUTOMATICOS } from "@/lib/plantillas/definiciones";
import type { PlantillaInicial } from "@/lib/plantillas/semillas";
import { esSlugDnx } from "@/lib/slug-dnx";

/**
 * Plantillas de Pedidos (tipo PEDIDO, etapa 3): el recibo de pago automático (todas las
 * organizaciones) y "Tu pedido" (sólo DNX Estudio). Sólo usan variables válidas para PEDIDO; las
 * que pueden faltar van en bloques `[si:…]`. Sin textos para completar a mano: se envían tal cual.
 */

/** Texto inicial del recibo de pago automático. */
export const RECIBO_INICIAL = {
  asunto: "Recibo de tu pago[si:recibo_numero] N° [recibo_numero][/si]",
  cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Gracias! Registramos tu pago[si:recibo_importe] de [recibo_importe][/si][si:pedido_numero] del pedido N° [pedido_numero][/si].

Podés ver, imprimir o guardar el recibo en este enlace:

[recibo_enlace]

[si:pedido_saldo]Saldo pendiente del pedido: [pedido_saldo].

[/si]Si tenés alguna duda, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
} as const;

const CLAVE_RECIBO = "RECIBO_DE_PAGO" as const;

/**
 * Crea, una sola vez por organización, la plantilla automática del recibo de pago (encendida por
 * omisión: se apaga en Configuración → Plantillas → Automáticos). Idempotente: conteo afuera y el
 * índice único (workspaceId, systemKey) adentro.
 */
export async function asegurarPlantillaRecibo(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeMessageTemplate.count({ where: { workspaceId, systemKey: CLAVE_RECIBO } })) > 0) return;
  const def = AUTOMATICOS[CLAVE_RECIBO];
  try {
    await prisma.fotofficeMessageTemplate.create({
      data: {
        workspaceId, systemKey: CLAVE_RECIBO, channel: def.canal, entityType: def.tipo, name: def.nombre,
        subject: RECIBO_INICIAL.asunto, body: RECIBO_INICIAL.cuerpo, enabled: true, order: 3,
      },
      select: { id: true },
    });
  } catch (e) {
    // Otra corrida la creó en el mismo instante: el índice único nos frena; da igual.
    if ((e as { code?: unknown })?.code !== "P2002") throw e;
  }
}

/** Texto inicial del recordatorio automático del vencimiento de una cuota (Entrega B1). */
export const RECORDATORIO_INICIAL = {
  asunto: "Recordatorio: vence una cuota[si:pedido_numero] de tu pedido N° [pedido_numero][/si]",
  cuerpo: `Hola[si:nombre], [nombre][/si]:

Te recordamos que el [cuota_vence] vence la cuota de [cuota_importe][si:pedido_numero] de tu pedido N° [pedido_numero][/si].

Podés ver el detalle y tus recibos acá:

[pedido_enlace]

Si ya la pagaste, no tengas en cuenta este mensaje. Cualquier duda, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
} as const;

const CLAVE_RECORDATORIO = "RECORDATORIO_CUOTA" as const;

/**
 * Crea, una sola vez por organización, la plantilla automática del recordatorio de cuotas. Nace
 * encendida: lo que decide si sale es el interruptor de Configuración → Pedidos (que nace apagado
 * salvo en DNX). Idempotente como `asegurarPlantillaRecibo`.
 */
export async function asegurarPlantillaRecordatorio(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeMessageTemplate.count({ where: { workspaceId, systemKey: CLAVE_RECORDATORIO } })) > 0) return;
  const def = AUTOMATICOS[CLAVE_RECORDATORIO];
  try {
    await prisma.fotofficeMessageTemplate.create({
      data: {
        workspaceId, systemKey: CLAVE_RECORDATORIO, channel: def.canal, entityType: def.tipo, name: def.nombre,
        subject: RECORDATORIO_INICIAL.asunto, body: RECORDATORIO_INICIAL.cuerpo, enabled: true, order: 4,
      },
      select: { id: true },
    });
  } catch (e) {
    if ((e as { code?: unknown })?.code !== "P2002") throw e;
  }
}

/** Plantillas iniciales "Tu pedido" de DNX Estudio, con el enlace del pedido. */
export const PLANTILLAS_PEDIDO_DNX: readonly PlantillaInicial[] = [
  {
    canal: "EMAIL",
    tipo: "PEDIDO",
    nombre: "Tu pedido",
    asunto: "Tu pedido[si:pedido_numero] N° [pedido_numero][/si]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

¡Gracias por confirmar! Ya tenemos registrado tu pedido[si:pedido_numero] N° [pedido_numero][/si].

En este enlace podés ver el detalle, el plan de pagos con sus vencimientos, lo que ya pagaste y los recibos:

[pedido_enlace]

[si:pedido_saldo]Saldo pendiente: [pedido_saldo].

[/si]Cualquier duda, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
  },
  {
    canal: "WHATSAPP",
    tipo: "PEDIDO",
    nombre: "Tu pedido",
    asunto: null,
    cuerpo: `¡Hola[si:nombre], [nombre][/si]! [si:organizacion]Te escribimos de [organizacion]. [/si]Acá podés ver tu pedido[si:pedido_numero] N° [pedido_numero][/si], el plan de pagos y los recibos:

[pedido_enlace]

Cualquier duda, escribinos por acá.`,
  },
];

/**
 * Crea, una sola vez y sólo en DNX Estudio, las plantillas "Tu pedido". La marca de "ya sembrado"
 * es que exista alguna plantilla común de tipo PEDIDO (también archivada; la automática del recibo
 * no cuenta): las que alguien borró del todo vuelven sólo si no queda ninguna. Idempotente: conteo
 * afuera y re-chequeo adentro, con un candado por organización.
 */
export async function asegurarPlantillasPedido(workspaceId: string, slug: string | null | undefined): Promise<void> {
  if (!esSlugDnx(slug)) return;
  const donde = { workspaceId, entityType: "PEDIDO", systemKey: null };
  if ((await prisma.fotofficeMessageTemplate.count({ where: donde })) > 0) return;
  await prisma.$transaction(async (tx) => {
    // Dos pestañas a la vez: el candado por organización las pone en fila y la segunda ya cuenta las de la primera.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-plantillas-pedido:${workspaceId}`}))`;
    if ((await tx.fotofficeMessageTemplate.count({ where: donde })) > 0) return;
    const ultimos = await tx.fotofficeMessageTemplate.findMany({ where: { workspaceId, systemKey: null }, select: { channel: true, order: true } });
    const siguiente = (canal: string) => Math.max(-1, ...ultimos.filter((u) => u.channel === canal).map((u) => u.order)) + 1;
    await tx.fotofficeMessageTemplate.createMany({
      data: PLANTILLAS_PEDIDO_DNX.map((p) => ({
        workspaceId, channel: p.canal, entityType: p.tipo, name: p.nombre, subject: p.asunto, body: p.cuerpo, order: siguiente(p.canal),
      })),
    });
  });
}
