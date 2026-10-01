import { notFound, redirect } from "next/navigation";
import { isReservedSlug } from "@/lib/entrada/institution-shortcut";

/**
 * Atajo a los cursos públicos de una institución: `/sfpr/cursos` → `/w/sfpr/cursos`.
 *
 * Ya existía antes del atajo general y redirigía sin mirar nada. Ahora comparte la misma
 * regla: un nombre reservado no redirige a ninguna parte.
 *
 * A diferencia de `/[workspaceSlug]`, acá no se consulta la base: si la institución no
 * existe, `/w/<slug>/cursos` responde 404 por su cuenta, y agregar una consulta de más solo
 * para adelantar ese 404 no cambia lo que ve la persona.
 */
export default async function PublicCoursesAliasPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  if (isReservedSlug(workspaceSlug)) notFound();
  redirect(`/w/${workspaceSlug.trim().toLowerCase()}/cursos`);
}
