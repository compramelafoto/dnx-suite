// lib/course-marketplace/orden.ts
import "server-only";
import { prisma } from "@repo/db";
import { workspaceOrganizationRef } from "@/lib/payments/connect/constants";
import {
  consentimientoDeCuenta,
  evidenciaDeConsentimiento,
  prepararOrdenDeCursoConReparto,
  type PagoConTarjeta,
  type ReceptorDeSplit,
  type ResultadoOrdenDeCurso,
} from "@/lib/payments/split-1n-cursos";
import { cobroConRepartoHabilitado } from "@/lib/payments/split-1n";
import { partesDesdeReparto } from "./venta";

/**
 * Receptores y consentimientos de cada negocio, desde lo registrado en la base (mismo camino que
 * `getStoredSplitConsent` de lib/payments/connect/consent.ts). No consulta a Mercado Pago.
 */
export async function cargarReceptores(workspaceIds: string[]): Promise<Map<string, ReceptorDeSplit>> {
  const receptores = new Map<string, ReceptorDeSplit>();
  for (const workspaceId of [...new Set(workspaceIds)]) {
    const identidad = await prisma.dnxFinancialIdentity.findUnique({
      where: { organizationRef: workspaceOrganizationRef(workspaceId) },
      select: { id: true },
    });
    if (!identidad) continue;
    const cuenta = await prisma.dnxPaymentAccount.findFirst({
      where: { financialIdentityId: identidad.id, provider: "MERCADOPAGO", environment: "PROD" },
      select: { providerUserId: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!cuenta?.providerUserId) continue;
    // Se busca por la cuenta (user_id numérico de MP): el receiver_id sale de la fila UUID de la
    // invitación y el estado, de la fila más reciente (el refresh guarda la aceptación en la numérica).
    const filas = await prisma.dnxSplitConsent.findMany({
      where: { provider: "MERCADOPAGO", environment: "PRODUCTION", primaryProviderAccountReference: cuenta.providerUserId },
      select: { providerReceiverId: true, status: true },
      orderBy: { updatedAt: "desc" },
    });
    const r = consentimientoDeCuenta(filas.map((f) => ({ providerReceiverId: f.providerReceiverId, status: String(f.status) })));
    if (r) receptores.set(workspaceId, r);
  }
  return receptores;
}

/** El receptor de la comisión de la plataforma: `FOTOFFICE_CURSOS_PLATAFORMA_MP_RECEIVER_ID`. */
export async function cargarReceptorDePlataforma(): Promise<ReceptorDeSplit | null> {
  const receiverId = process.env.FOTOFFICE_CURSOS_PLATAFORMA_MP_RECEIVER_ID?.trim();
  if (!receiverId) return null;
  const consentimiento = await prisma.dnxSplitConsent.findFirst({
    where: { provider: "MERCADOPAGO", environment: "PRODUCTION", providerReceiverId: receiverId },
    select: { providerReceiverId: true, status: true },
  });
  return evidenciaDeConsentimiento(consentimiento ? { providerReceiverId: consentimiento.providerReceiverId, status: String(consentimiento.status) } : null);
}

/**
 * La orden de una inscripción con reparto, desde su reparto congelado. Hoy devuelve
 * SPLIT_APAGADO sin tocar la base. Falta, para cuando MP habilite el split: el Card Brick en la
 * página del curso (token y sesión del pagador), el POST con `MercadoPagoOrdersAdapter` y el
 * webhook de órdenes. Nada de eso se construye en este plan.
 */
export async function armarOrdenParaInscripcion(enrollmentId: string, pago: PagoConTarjeta): Promise<ResultadoOrdenDeCurso> {
  if (!cobroConRepartoHabilitado()) {
    return { ok: false, codigo: "SPLIT_APAGADO", detalle: "El reparto automático de Mercado Pago está apagado para FOTOFFICE." };
  }
  const inscripcion = await prisma.courseEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      email: true,
      paymentStatus: true,
      course: { select: { title: true } },
      saleShares: {
        orderBy: { createdAt: "asc" },
        select: { workspaceId: true, kind: true, label: true, amountArs: true, absorbsProcessorFee: true },
      },
    },
  });
  if (!inscripcion || inscripcion.paymentStatus !== "PENDING" || inscripcion.saleShares.length === 0) {
    return { ok: false, codigo: "INVALIDA", detalle: "La inscripción no está pendiente de pago o no tiene reparto." };
  }
  const partes = partesDesdeReparto(inscripcion.saleShares);
  const [receptores, plataforma] = await Promise.all([
    cargarReceptores(partes.filter((p) => p.tipo !== "PLATAFORMA").map((p) => p.id)),
    cargarReceptorDePlataforma(),
  ]);
  return prepararOrdenDeCursoConReparto({
    enrollmentId: inscripcion.id,
    tituloCurso: inscripcion.course.title,
    payerEmail: inscripcion.email,
    partes,
    receptores,
    plataforma,
    pago,
  });
}
