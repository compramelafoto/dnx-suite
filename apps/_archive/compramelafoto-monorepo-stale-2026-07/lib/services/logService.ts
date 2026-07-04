import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

interface LogActionParams {
  actorId: number;
  actorRole: Role;
  actorEmail?: string;
  entity: string; // "PrintOrder", "Lab", "User", "Config", etc.
  entityId?: number;
  action: string; // "UPDATE_STATUS", "CHANGE_COMMISSION", "APPROVE_LAB", etc.
  description?: string;
  beforeData?: any;
  afterData?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Crea un log de auditoría
 */
export async function createAdminLog(params: LogActionParams) {
  const {
    actorId,
    actorRole,
    actorEmail,
    entity,
    entityId,
    action,
    description,
    beforeData,
    afterData,
    ipAddress,
    userAgent,
  } = params;

  // Preparar datos antes/después (solo campos relevantes, no todo el objeto)
  const beforeJson = beforeData ? sanitizeLogData(beforeData) : null;
  const afterJson = afterData ? sanitizeLogData(afterData) : null;

  const log = await prisma.adminLog.create({
    data: {
      actorId,
      actorRole,
      actorEmail: actorEmail || undefined,
      entity,
      entityId: entityId || undefined,
      action,
      description: description || `${action} en ${entity}${entityId ? ` #${entityId}` : ""}`,
      beforeData: beforeJson,
      afterData: afterJson,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      printOrderId: entity === "PrintOrder" && entityId ? entityId : undefined,
    },
  });

  return log;
}

/**
 * Sanitiza datos para el log (solo campos relevantes, sin passwords ni datos sensibles)
 */
function sanitizeLogData(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sanitized: any = {};
  const sensitiveFields = ["password", "token", "secret", "key", "accessToken", "refreshToken"];

  for (const [key, value] of Object.entries(data)) {
    // Omitir campos sensibles
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    // Si es un objeto anidado, sanitizarlo recursivamente
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Obtiene logs con filtros
 */
export async function getAdminLogs(filters: {
  actorId?: number;
  entity?: string;
  entityId?: number;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};

  if (filters.actorId) {
    where.actorId = filters.actorId;
  }

  if (filters.entity) {
    where.entity = filters.entity;
  }

  if (filters.entityId !== undefined) {
    where.entityId = filters.entityId;
  }

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const logs = await prisma.adminLog.findMany({
    where,
    include: {
      actor: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: filters.limit || 100,
    skip: filters.offset || 0,
  });

  const total = await prisma.adminLog.count({ where });

  return {
    logs,
    total,
  };
}
