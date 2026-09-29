import "server-only";
import { prisma } from "@repo/db";

/** Categorías de notas de DNX Estudio, en este orden. */
export const CATEGORIAS_DNX: readonly string[] = [
  "URGENTE",
  "Coordinación",
  "Correcciones",
  "Hacer contrato",
  "Contacto por Teléfono",
  "Correo",
  "Presupuesto",
  "Visita",
  "Recordatorio",
  "Envío de Material",
  "Revisión",
  "Selección de Pruebas",
  "Otro",
];

const CATEGORIAS_GENERAL: readonly string[] = ["General"];

export function categoriasIniciales(slug: string): readonly string[] {
  return slug === "dnx-estudio" ? CATEGORIAS_DNX : CATEGORIAS_GENERAL;
}

/**
 * Crea las categorías iniciales sólo si el workspace no tiene ninguna. Dos pedidos a la vez
 * pueden chocar contra el único (workspaceId, name): con `skipDuplicates` el segundo no falla.
 */
export async function asegurarCategorias(workspaceId: string, slug: string): Promise<void> {
  const hay = await prisma.fotofficeNoteCategory.count({ where: { workspaceId } });
  if (hay > 0) return;
  await prisma.fotofficeNoteCategory.createMany({
    data: categoriasIniciales(slug).map((name, order) => ({ workspaceId, name, order })),
    skipDuplicates: true,
  });
}

export async function listarCategorias(workspaceId: string): Promise<{ id: string; name: string }[]> {
  return prisma.fotofficeNoteCategory.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}
