import { prisma } from "@repo/db";

/**
 * Datos del envío para el correo de confirmación. Consulta aparte y sin
 * romper: si la tabla todavía no existe en esta base, el correo sale igual,
 * con el bloque de acreditación presencial.
 */
export async function loadShippingForEmail(
  registrationId: string,
): Promise<{ city: string; province: string; guaranteed: boolean } | null> {
  try {
    return await prisma.clickatonRegistrationShipping.findUnique({
      where: { registrationId },
      select: { city: true, province: true, guaranteed: true },
    });
  } catch (error) {
    console.error("[clickaton] loadShippingForEmail falló:", error);
    return null;
  }
}
