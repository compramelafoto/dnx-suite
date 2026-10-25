import "server-only";
import { prisma } from "@repo/db";
import { categoriasDeFormularios } from "./categorias";

export type FormularioReemplazado = {
  formularioId: string;
  formulario: string;
  /** La categoría que recibe hoy sus consultas; null si el workspace no tiene ninguna activa. */
  categoria: string | null;
};

/**
 * Formularios públicos cuya categoría equivalente está archivada (spec §5): sus consultas entran
 * en "Otro" del mismo grupo o en la primera activa. Configuración → Consultas lo avisa. Es la
 * misma resolución que corre en cada alta (`categoriasDeFormularios`); no guarda nada.
 */
export async function formulariosConCategoriaReemplazada(workspaceId: string): Promise<FormularioReemplazado[]> {
  const [mapa, formularios] = await Promise.all([
    categoriasDeFormularios(workspaceId),
    prisma.serviceLeadForm.findMany({ where: { workspaceId }, select: { id: true, name: true }, take: 500 }),
  ]);
  const nombres = new Map(formularios.map((f) => [f.id, f.name]));
  const reemplazados: FormularioReemplazado[] = [];
  for (const [id, categoria] of mapa) {
    if (categoria && !categoria.reemplazo) continue;
    reemplazados.push({ formularioId: id, formulario: nombres.get(id) ?? "Formulario", categoria: categoria?.name ?? null });
  }
  return reemplazados.sort((a, b) => a.formulario.localeCompare(b.formulario, "es"));
}
