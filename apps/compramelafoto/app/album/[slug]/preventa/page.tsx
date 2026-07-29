import { redirect } from "next/navigation";

/**
 * Ruta legacy: misma experiencia que `/album/[slug]` (landing dinámica).
 * Redirige suave conservando query params (refs, UTM, etc.).
 */
export default async function PreventaRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await Promise.resolve(params);
  if (!slug) {
    redirect("/");
  }
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const qs = resolvedSearchParams
    ? new URLSearchParams(
        Object.entries(resolvedSearchParams).flatMap(([key, value]) =>
          Array.isArray(value) ? value.map((v) => [key, v]) : value != null ? [[key, value]] : []
        )
      ).toString()
    : "";
  redirect(`/album/${slug}${qs ? `?${qs}` : ""}`);
}
