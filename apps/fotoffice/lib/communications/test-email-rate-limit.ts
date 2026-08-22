import { prisma } from "@repo/db";
import {
  PER_USER_HOURLY_LIMIT,
  RATE_LIMIT_WINDOW_MINUTES,
  TEST_EMAIL_TEMPLATE_KEY,
} from "./constants";

/**
 * Tope de la herramienta "Enviar email de prueba": 3 por persona y por hora.
 *
 * Aplica solo a este botón. Las comunicaciones reales no pasan por este control.
 *
 * Nadie está exento — tampoco el SUPER_ADMIN: esta función no recibe el rol, así que no hay
 * forma de saltearlo desde el llamador.
 *
 * Se cuentan TODOS los intentos registrados, incluidos los que fallaron. Un fallo de
 * configuración no puede convertirse en permiso para martillar al proveedor.
 *
 * Los números viven en `./constants` porque el panel los muestra en pantalla y es un
 * componente cliente: este módulo importa Prisma y no puede cruzar esa frontera.
 */

export type RateLimitDecision = { allowed: true } | { allowed: false };

export async function checkTestEmailRateLimit(args: {
  userId: number;
  /** Inyectable para los tests; en producción es el reloj del servidor. */
  now?: Date;
}): Promise<RateLimitDecision> {
  const now = args.now ?? new Date();
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60_000);

  const recent = await prisma.sentEmailLog.count({
    where: {
      templateKey: TEST_EMAIL_TEMPLATE_KEY,
      userId: args.userId,
      createdAt: { gte: since },
    },
  });

  return recent >= PER_USER_HOURLY_LIMIT ? { allowed: false } : { allowed: true };
}
