import { prisma } from "@/lib/prisma";

/**
 * Carga TemplateV2 + la versión de trabajo + bloques/assets/bindings sin depender de `include` sin relaciones en Prisma.
 */
export async function loadTemplateV2DuplicateGraph(templateId: string): Promise<any | null> {
  const template = await prisma.templateV2.findUnique({
    where: { id: templateId },
  });
  if (!template) return null;

  let version =
    template.currentVersionId != null ?
      await prisma.templateV2Version.findUnique({
        where: { id: template.currentVersionId },
      })
    : null;

  if (!version) {
    const fallback = await prisma.templateV2Version.findFirst({
      where: { templateId },
      orderBy: { versionNumber: "desc" },
    });
    version = fallback;
  }
  if (!version) return null;

  const [blocks, assets, variableBindings] = await Promise.all([
    prisma.templateV2Block.findMany({ where: { templateVersionId: version.id } }),
    prisma.templateV2Asset.findMany({ where: { templateVersionId: version.id } }),
    prisma.templateV2VariableBinding.findMany({ where: { templateVersionId: version.id } }),
  ]);

  return {
    ...template,
    currentVersion: {
      ...version,
      blocks,
      assets,
      variableBindings,
    },
    versions: [],
  };
}
