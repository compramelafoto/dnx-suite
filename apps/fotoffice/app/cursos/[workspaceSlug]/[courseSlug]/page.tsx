import { redirect } from "next/navigation";

export default async function PublicCourseAliasPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; courseSlug: string }>;
}) {
  const { workspaceSlug, courseSlug } = await params;
  redirect(`/w/${workspaceSlug}/cursos/${courseSlug}`);
}
