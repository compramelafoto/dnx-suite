import { redirect } from "next/navigation";

/**
 * Ruta legacy: misma experiencia que `/album/[slug]` (landing dinámica).
 * Redirige suave conservando query params (refs, UTM, etc.).
 */
export default async function PreventaRedirect({
  params,
  searchParams,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { slug } = await Promise.resolve(params);
  if (!slug) {
    redirect("/");
  }
  const qs = searchParams
    ? new URLSearchParams(
        Object.entries(searchParams).flatMap(([key, value]) =>
          Array.isArray(value) ? value.map((v) => [key, v]) : value != null ? [[key, value]] : []
        )
      ).toString()
    : "";
  redirect(`/album/${slug}${qs ? `?${qs}` : ""}`);
}
