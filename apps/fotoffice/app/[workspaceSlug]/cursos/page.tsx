import { redirect } from "next/navigation";

export default async function PublicCoursesAliasPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  redirect(`/w/${workspaceSlug}/cursos`);
}
