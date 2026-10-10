import "server-only";
import { prisma } from "@repo/db";
import { dondePuede } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";
import type { MuestraParaPiezas } from "./textos";

/** Una muestra con `pieces` (dueño, coorganización o super admin), de tipo muestra; publicada si se pide. */
export function cargarMuestraParaPiezas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  { publicada }: { publicada: boolean },
): Promise<MuestraParaPiezas | null> {
  return prisma.culturalActivity.findFirst({
    where: {
      id, type: "MUESTRA",
      ...(publicada ? { reviewStatus: "APPROVED" } : {}),
      ...dondePuede(usuario, "pieces"),
    },
    select: {
      id: true, slug: true, title: true, organizersText: true, curatorialText: true, curatorCredits: true,
      startsAt: true, endsAt: true, scheduleText: true, venueName: true, address: true, city: true, province: true,
      coverImageUrl: true, hangingPlan: true, updatedAt: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, imageUrl: true, sortOrder: true } },
    },
  });
}
