import "server-only";
import { OrderOrigin, prisma } from "@/lib/prisma";
import { parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";

/**
 * Los cursos para que la familia diga de qué curso es el librito: los del padrón del álbum
 * («6° Grado A», como los escribe el Excel de los packs) y, si no hay padrón, los de los packs
 * cargados. Con el curso, el librito lleva el listado de los compañeros.
 */
export async function cursosDelAlbumParaElLibrito(albumId: number): Promise<string[]> {
  const padron = await prisma.albumStudentRosterEntry.findMany({
    where: { albumId, isActive: true },
    distinct: ["courseName", "division"],
    select: { courseName: true, division: true },
  });
  const nombres = padron.map((f) => [f.courseName, f.division].map((x) => (x ?? "").trim()).filter(Boolean).join(" "));
  if (nombres.length === 0) {
    const packs = await prisma.order.findMany({
      where: { albumId, origin: OrderOrigin.PREVENTA_PACK },
      select: { redemptionPaymentRefsJson: true },
    });
    for (const p of packs) {
      const curso = parseExternalPreventaRefs(p.redemptionPaymentRefsJson)?.courseName?.trim();
      if (curso && !/sin divisi/i.test(curso)) nombres.push(curso);
    }
  }
  return [...new Set(nombres.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/**
 * El colegio del librito. Los álbumes de packs cobrados por fuera pueden no estar vinculados a un
 * colegio (vincularlos los pasa a modo escolar); el nombre viene entonces con los packs del Excel.
 */
export async function colegioDelAlbum(
  albumId: number,
  school: { name: string | null; logoUrl: string | null } | null | undefined
): Promise<{ name: string | null; logoUrl: string | null }> {
  if (school?.name) return { name: school.name, logoUrl: school.logoUrl ?? null };
  const packs = await prisma.order.findMany({
    where: { albumId, origin: OrderOrigin.PREVENTA_PACK },
    select: { redemptionPaymentRefsJson: true },
    orderBy: { id: "desc" },
    take: 20,
  });
  const name =
    packs.map((p) => parseExternalPreventaRefs(p.redemptionPaymentRefsJson)?.schoolName?.trim()).find(Boolean) ?? null;
  return { name, logoUrl: school?.logoUrl ?? null };
}
