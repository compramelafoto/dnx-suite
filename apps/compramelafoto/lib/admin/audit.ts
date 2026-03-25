import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export interface AuditLogData {
  action: string;
  entityType: string;
  entityId?: number | null;
  description?: string;
  beforeData?: any;
  afterData?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Registra una acción administrativa en el log de auditoría
 */
export async function logAdminAction(data: AuditLogData): Promise<void> {
  try {
    const user = await getAuthUser();
    
    if (!user || user.role !== Role.ADMIN) {
      console.warn("Intento de log de auditoría sin usuario ADMIN:", data);
      return;
    }

    await prisma.adminLog.create({
      data: {
        actorId: user.id,
        actorRole: user.role,
        actorEmail: user.email,
        entity: data.entityType,
        entityId: data.entityId || null,
        action: data.action,
        description: data.description || null,
        beforeData: data.beforeData ? JSON.parse(JSON.stringify(data.beforeData)) : null,
        afterData: data.afterData ? JSON.parse(JSON.stringify(data.afterData)) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        printOrderId: data.entityType === "PrintOrder" ? data.entityId || null : null,
      },
    });
  } catch (err: any) {
    // No fallar la operación principal si falla el log
    console.error("Error registrando acción de auditoría:", err);
  }
}

/**
 * Helper para obtener IP y User-Agent desde un Request de Next.js
 */
export function getRequestMetadata(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const headers = req.headers;
  const ipAddress =
    headers.get("x-forwarded-for")?.split(",")[0] ||
    headers.get("x-real-ip") ||
    null;
  const userAgent = headers.get("user-agent") || null;

  return { ipAddress, userAgent };
}
