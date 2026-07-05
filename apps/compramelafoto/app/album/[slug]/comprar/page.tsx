import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

/**
 * Redirect legacy: `/album/[slug]/comprar` → `/a/[albumId]/comprar`
 * Preserva query (`preventaPackToken`, `preventaPackOrderId`, etc.).
 */
export default async function AlbumComprarLegacyRedirect({ params, searchParams }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const rawSlug = decodeURIComponent(String(slug || "").trim());
  if (!rawSlug) notFound();

  const album = await prisma.album.findFirst({
    where: { publicSlug: rawSlug, deletedAt: null },
    select: { id: true },
  });
  if (!album) notFound();

  const sp = await Promise.resolve(searchParams);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const query = qs.toString();
  redirect(`/a/${album.id}/comprar${query ? `?${query}` : ""}`);
}
