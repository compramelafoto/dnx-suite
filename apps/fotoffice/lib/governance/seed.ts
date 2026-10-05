import "server-only";
import { prisma, Prisma } from "@repo/db";
import { DEFAULT_PROJECT_TEMPLATES, type TemplateStage } from "./templates";

/**
 * Los tipos de proyecto con que arranca cada institución.
 *
 * Se siembran la primera vez que alguien abre el módulo, no con la migración: así una institución
 * que nunca enciende Gobierno no carga filas que no usa, y la siembra se prueba con el código.
 * Si ya tiene algún tipo (aunque esté archivado) no se toca nada: los que borró o renombró son
 * decisión suya.
 */
export async function ensureDefaultProjectTypes(workspaceId: string): Promise<void> {
  const existentes = await prisma.govProjectType.count({ where: { workspaceId } });
  if (existentes > 0) return;
  try {
    await prisma.$transaction(async (tx) => {
      for (const [i, plantilla] of DEFAULT_PROJECT_TEMPLATES.entries()) {
        await tx.govProjectType.create({
          data: {
            workspaceId,
            name: plantilla.name,
            description: plantilla.description,
            templateKey: plantilla.key,
            order: i,
            stages: { create: stagesCreateInput(plantilla.stages) },
          },
        });
      }
    });
  } catch (e) {
    // Dos pestañas abiertas a la vez: la otra ya sembró. El nombre es único por institución.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return;
    throw e;
  }
}

export function stagesCreateInput(stages: readonly TemplateStage[]) {
  return stages.map((s, i) => ({
    title: s.title,
    order: i,
    tasks: { create: s.tasks.map((t, j) => ({ title: t, order: j })) },
  }));
}
