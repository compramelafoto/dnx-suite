import { prisma } from "@/lib/prisma";

/**
 * A dónde vuelve la persona después de conectar Mercado Pago: el colegio, a su panel; el
 * laboratorio y el fotógrafo, a su configuración.
 */
export async function rutaDeVueltaMercadoPago(
  userId: number | null,
  role: string | null,
  ownerType: string,
  params: Record<string, string>,
): Promise<string> {
  let path = ownerType === "LAB" ? "/lab/configuracion" : "/fotografo/configuracion";
  if (ownerType === "USER" && role === "SCHOOL_ORGANIZER" && userId != null) {
    const org = await prisma.schoolOrganizer.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { schoolId: true },
    });
    path = org ? `/escuela/${org.schoolId}` : "/escuela";
  }
  const query = new URLSearchParams(params).toString();
  return query ? `${path}?${query}` : path;
}
