import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { LAB_TERMS_VERSION } from "@/lib/terms/labTerms";
import { PHOTOGRAPHER_TERMS_VERSION } from "@/lib/terms/photographerTermsExtended";

/**
 * Verifica si un usuario (LAB o PHOTOGRAPHER) tiene los T&C aceptados para su rol
 */
export async function hasAcceptedTerms(userId: number, role: Role): Promise<boolean> {
  try {
    // Determinar versión activa según rol
    const activeVersion = role === Role.LAB || role === Role.LAB_PHOTOGRAPHER 
      ? LAB_TERMS_VERSION 
      : PHOTOGRAPHER_TERMS_VERSION;

    // Buscar aceptación más reciente
    const acceptance = await prisma.termsAcceptance.findFirst({
      where: {
        userId,
        role: role === Role.LAB_PHOTOGRAPHER ? Role.LAB : role, // LAB_PHOTOGRAPHER acepta como LAB
        termsVersion: activeVersion,
      },
      orderBy: { acceptedAt: "desc" },
    });

    return !!acceptance;
  } catch (err) {
    console.error("Error verificando T&C:", err);
    return false;
  }
}

/**
 * Verifica si un usuario tiene Mercado Pago conectado
 */
export async function hasMercadoPagoConnected(userId: number, role: Role): Promise<boolean> {
  try {
    if (role === Role.LAB || role === Role.LAB_PHOTOGRAPHER) {
      const lab = await prisma.lab.findUnique({
        where: { userId },
        select: { mpUserId: true, mpAccessToken: true },
      });
      return !!(lab?.mpUserId && lab?.mpAccessToken);
    } else if (role === Role.PHOTOGRAPHER) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { mpUserId: true, mpAccessToken: true },
      });
      return !!(user?.mpUserId && user?.mpAccessToken);
    }
    return false;
  } catch (err) {
    console.error("Error verificando MP:", err);
    return false;
  }
}

/**
 * Verifica si un LAB está aprobado y puede recibir pedidos
 */
export async function canLabReceiveOrders(labId: number): Promise<{ canReceive: boolean; reason?: string }> {
  try {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: {
        approvalStatus: true,
        userId: true,
        mpUserId: true,
        mpAccessToken: true,
      },
    });

    if (!lab) {
      return { canReceive: false, reason: "Laboratorio no encontrado" };
    }

    if (lab.approvalStatus !== "APPROVED") {
      return { canReceive: false, reason: `Estado: ${lab.approvalStatus}. Debe estar APPROVED para recibir pedidos.` };
    }

    if (!lab.mpUserId || !lab.mpAccessToken) {
      return { canReceive: false, reason: "Mercado Pago no conectado. Es obligatorio conectar MP para recibir pedidos." };
    }

    return { canReceive: true };
  } catch (err) {
    console.error("Error verificando capacidad de recibir pedidos:", err);
    return { canReceive: false, reason: "Error verificando estado" };
  }
}

/**
 * Formatea moneda ARS sin decimales
 */
export function formatARS(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea fecha local
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

/**
 * Formatea fecha solo (sin hora)
 */
export function formatDateOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}
