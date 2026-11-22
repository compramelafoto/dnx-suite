import "server-only";
import { prisma } from "@repo/db";
import { fichaDetail } from "@repo/muestras";
import { distinctionsForWorks, obrasSoloOnline } from "@/lib/concursos/publico";
import { conPermiso } from "@/lib/equipo/permisos";
import { marcaDeDisciplina } from "@/lib/marca";
import { asegurarCodigosDeSala } from "@/lib/sala/codigos";
import type { Usuario } from "@/lib/usuario";
import { baseUrlPublica } from "./base-publica";
import { datosDeFicha, type FichaDeObra } from "./texto";

// La dirección pública vive aparte (sin base ni React) para que la usen también los correos.
export { baseUrlPublica } from "./base-publica";

/**
 * Las fichas de una muestra **publicada** de la persona (cualquiera, si es super admin): una
 * ficha con QR a una página que no existe no sirve. `null` = no corresponde (no existe, no es
 * suya, no está publicada, no es una muestra, o la obra pedida no es de esta muestra).
 *
 * Etapa 6: cada QR lleva el código de sala de su obra (se crea la primera vez y después es el
 * mismo) y las obras de expositores suman medidas y edición. El precio nunca.
 *
 * Etapa 7: las obras de un concurso marcadas "sólo online" (no se imprimen) no tienen ficha, y las
 * que sí llevan su premio antes de los datos.
 */
export async function cargarFichas(
  id: string,
  usuario: Pick<Usuario, "id" | "esSuperAdmin">,
  obraId: string | null,
): Promise<{ nombre: string; activityId: string; fichas: FichaDeObra[] } | null> {
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id, reviewStatus: "APPROVED", type: "MUESTRA" }, usuario, "pieces"),
    select: {
      id: true, slug: true, title: true, primaryDiscipline: true,
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, authorName: true, year: true, technique: true, sortOrder: true } },
    },
  });
  if (!a) return null;
  const soloOnline = await obrasSoloOnline(a.id);
  const imprimibles = a.works.filter((w) => !soloOnline.has(w.id));
  const obras = obraId ? imprimibles.filter((w) => w.id === obraId) : imprimibles;
  if (obras.length === 0) return null;
  const ids = obras.map((o) => o.id);
  const [codigos, deExpositor, premios] = await Promise.all([
    asegurarCodigosDeSala(a.id, ids), detallesDeExpositor(a.id, ids), distinctionsForWorks(a.id, ids),
  ]);
  const base = baseUrlPublica(undefined, a.primaryDiscipline);
  const { dominio } = marcaDeDisciplina(a.primaryDiscipline);
  return {
    nombre: obraId ? `ficha-${a.slug}-${obras[0]!.sortOrder + 1}` : `fichas-${a.slug}`,
    activityId: a.id,
    fichas: obras.map((o) => ({
      ...datosDeFicha(a, o, base, { codigo: codigos.get(o.id), detalle: deExpositor.get(o.id), distincion: premios.get(o.id) }),
      dominio,
    })),
  };
}

/** La línea de datos de cada obra que cargó un expositor, por id de la obra de la muestra. */
export async function detallesDeExpositor(activityId: string, workIds: readonly string[]): Promise<Map<string, string>> {
  if (!workIds.length) return new Map();
  const filas = await prisma.culturalExhibitorWork.findMany({
    where: { activityId, activityWorkId: { in: [...workIds] } },
    // Sin `priceArs`: no va en ninguna pieza (spec D38).
    select: { activityWorkId: true, year: true, technique: true, imageWidthCm: true, imageHeightCm: true, edition: true, editionNumber: true, editionSize: true },
  });
  return new Map(filas.flatMap((f) => {
    const d = fichaDetail(f);
    return f.activityWorkId && d ? [[f.activityWorkId, d] as const] : [];
  }));
}
