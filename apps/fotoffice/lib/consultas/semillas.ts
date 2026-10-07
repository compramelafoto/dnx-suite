import "server-only";
import { prisma } from "@repo/db";
import { semillasPara } from "./constantes";

/**
 * Catálogos iniciales de Consultas (spec §3.4): DNX Estudio recibe sus 21 categorías, 8
 * orígenes y 16 roles; las demás organizaciones, una categoría por cada uno de los 9 tipos viejos,
 * el origen "Otro" y ningún rol.
 *
 * Los formularios públicos existentes (`ServiceLeadForm`) no guardan categoría: no se agregan
 * columnas a tablas existentes, así que su categoría se resuelve en cada alta por el
 * `legacyEventType` de la semilla (`categoriaParaEventType`). Por eso esta semilla no los toca.
 *
 * La marca de "ya sembrado" son las categorías: si el workspace tiene alguna, no se toca nada
 * (lo que alguien borró o archivó no vuelve). Idempotente: conteo simple afuera y re-chequeo
 * adentro de la transacción; si otra corrida sembró en el mismo instante, el único frena y da igual.
 */
export async function asegurarCatalogosIniciales(workspaceId: string, slug: string | null | undefined): Promise<void> {
  if ((await prisma.fotofficeConsultaCategoria.count({ where: { workspaceId } })) > 0) return;
  const semillas = semillasPara(slug);
  try {
    await prisma.$transaction(async (tx) => {
      if ((await tx.fotofficeConsultaCategoria.count({ where: { workspaceId } })) > 0) return;
      await tx.fotofficeConsultaCategoria.createMany({
        data: semillas.categorias.map((c, order) => ({
          workspaceId, name: c.name, group: c.group, legacyEventType: c.legacyEventType, order,
        })),
      });
      // Orígenes y roles pueden existir sin categorías (los cargó alguien antes): no se repiten.
      await tx.fotofficeOrigen.createMany({
        data: semillas.origenes.map((name, order) => ({ workspaceId, name, order })),
        skipDuplicates: true,
      });
      if (semillas.roles.length > 0) {
        await tx.fotofficeRolParticipante.createMany({
          data: semillas.roles.map((name, order) => ({ workspaceId, name, order })),
          skipDuplicates: true,
        });
      }
    });
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
  }
}

/** Igual, leyendo el slug público del workspace (para quien no lo tiene a mano). */
export async function asegurarCatalogosDelWorkspace(workspaceId: string): Promise<void> {
  if ((await prisma.fotofficeConsultaCategoria.count({ where: { workspaceId } })) > 0) return;
  const branding = await prisma.fotofficeWorkspaceBranding.findFirst({ where: { workspaceId }, select: { publicSlug: true } });
  await asegurarCatalogosIniciales(workspaceId, branding?.publicSlug ?? "");
}
