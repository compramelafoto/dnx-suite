import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";
import { datosDeFicha, type FichaDeObra } from "./texto";

/** La dirección pública del sitio, la que va en el QR. En local apunta a `localhost`. */
export function baseUrlPublica(): string {
  return (process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://muestrasfotograficas.com").replace(/\/+$/, "");
}

/**
 * Las fichas de una muestra **publicada** de la persona (cualquiera, si es super admin): una
 * ficha con QR a una página que no existe no sirve. `null` = no corresponde (no existe, no es
 * suya, no está publicada, no es una muestra, o la obra pedida no es de esta muestra).
 */
export async function cargarFichas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  obraId: string | null,
): Promise<{ nombre: string; fichas: FichaDeObra[] } | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: { id, reviewStatus: "APPROVED", type: "MUESTRA", ...(usuario.esSuperAdmin ? {} : { proposedByUserId: usuario.id }) },
    select: {
      slug: true, title: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const obras = obraId ? a.works.filter((w) => w.id === obraId) : a.works;
  if (obras.length === 0) return null;
  const base = baseUrlPublica();
  return {
    nombre: obraId ? `ficha-${a.slug}-${obras[0]!.sortOrder + 1}` : `fichas-${a.slug}`,
    fichas: obras.map((o) => datosDeFicha(a, o, base)),
  };
}
