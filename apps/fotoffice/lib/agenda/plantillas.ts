import "server-only";
import { prisma } from "@repo/db";
import { AUTOMATICOS } from "@/lib/plantillas/definiciones";

/**
 * Plantilla automática del recordatorio de una cita (Etapa 4, Agenda). Sólo usa variables válidas
 * para CITA; las que pueden faltar (hora de una cita de todo el día, lugar) van en bloques `[si:…]`.
 */
export const RECORDATORIO_CITA_INICIAL = {
  asunto: "Recordatorio: [cita_titulo]",
  cuerpo: `Hola[si:nombre], [nombre][/si]:

Te recordamos tu cita «[cita_titulo]» del [cita_fecha][si:cita_hora] a las [cita_hora][/si][si:cita_lugar], en [cita_lugar][/si].

Si necesitás cambiarla, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
} as const;

const CLAVE = "RECORDATORIO_CITA" as const;

/**
 * Crea, una sola vez por organización, la plantilla automática del recordatorio de citas. Nace
 * encendida: lo que decide si sale es el interruptor de Configuración → Agenda (que nace apagado).
 * Idempotente: conteo afuera y el índice único (workspaceId, systemKey) adentro.
 */
export async function asegurarPlantillaRecordatorioCita(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeMessageTemplate.count({ where: { workspaceId, systemKey: CLAVE } })) > 0) return;
  const def = AUTOMATICOS[CLAVE];
  try {
    await prisma.fotofficeMessageTemplate.create({
      data: {
        workspaceId, systemKey: CLAVE, channel: def.canal, entityType: def.tipo, name: def.nombre,
        subject: RECORDATORIO_CITA_INICIAL.asunto, body: RECORDATORIO_CITA_INICIAL.cuerpo, enabled: true, order: 5,
      },
      select: { id: true },
    });
  } catch (e) {
    if ((e as { code?: unknown })?.code !== "P2002") throw e;
  }
}
