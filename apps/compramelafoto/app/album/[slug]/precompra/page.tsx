import { redirect } from "next/navigation";

/**
 * Redirige a la URL con nomenclatura correcta: /album/[slug]/preventa
 */
export default async function PrecompraRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/album/${slug}/preventa`);
}
