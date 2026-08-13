import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageShell } from "@/components/page-shell";
import { ArticleCard } from "@/components/editorial/article-cards";
import { authorDisplayName, getPublishedArticlesByAuthor } from "@/lib/articles";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) return { title: "Autor" };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, bio: true },
  });
  if (!user) return { title: "Autor" };
  const name = authorDisplayName(user);
  return {
    title: name,
    description: user.bio?.trim() || `Notas de ${name} en Info Spot`,
  };
}

function socialHref(
  raw: string | null | undefined,
  kind: "instagram" | "facebook" | "tiktok" | "web",
) {
  const v = raw?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (kind === "instagram") {
    const handle = v.replace(/^@/, "");
    return `https://instagram.com/${handle}`;
  }
  if (kind === "tiktok") {
    const handle = v.replace(/^@/, "");
    return `https://www.tiktok.com/@${handle}`;
  }
  if (kind === "facebook") {
    return v.includes("facebook.com")
      ? `https://${v.replace(/^https?:\/\//, "")}`
      : `https://facebook.com/${v}`;
  }
  return v.startsWith("http") ? v : `https://${v}`;
}

export default async function AutorPublicPage({ params }: Props) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId < 1) notFound();

  const membership = await prisma.infoSpotUserRole.findUnique({
    where: { userId },
    select: { status: true, role: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      city: true,
      province: true,
      website: true,
      instagram: true,
      facebook: true,
      tiktok: true,
      logoUrl: true,
      role: true,
    },
  });

  if (!user) notFound();

  const isSuiteAdmin = user.role === "SUPER_ADMIN";
  const isActiveEditorial = membership?.status === "ACTIVE" || isSuiteAdmin;
  if (!isActiveEditorial) notFound();

  const name = authorDisplayName(user);
  const initial = (name.trim()[0] || "?").toUpperCase();
  const location = [user.city?.trim(), user.province?.trim()].filter(Boolean).join(", ");
  const articles = await getPublishedArticlesByAuthor(userId, 24);

  const links = [
    { label: "Web", href: socialHref(user.website, "web") },
    { label: "Instagram", href: socialHref(user.instagram, "instagram") },
    { label: "Facebook", href: socialHref(user.facebook, "facebook") },
    { label: "TikTok", href: socialHref(user.tiktok, "tiktok") },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  const roleLabel =
    membership?.role === "INFOSPOT_DIRECTOR"
      ? "Dirección"
      : membership?.role === "INFOSPOT_REDACTOR"
        ? "Redacción"
        : membership?.role === "INFOSPOT_COLABORADOR"
          ? "Colaboración"
          : isSuiteAdmin
            ? "Dirección"
            : null;

  return (
    <PageShell
      title={name}
      description={
        location
          ? `${roleLabel ? `${roleLabel} · ` : ""}${location}`
          : roleLabel || "Equipo editorial de Info Spot"
      }
    >
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        {user.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.logoUrl}
            alt=""
            width={112}
            height={112}
            className="size-28 shrink-0 rounded-full object-cover ring-1 ring-[var(--is-border)]"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden
            className="inline-flex size-28 shrink-0 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-3xl font-semibold text-[var(--is-muted)] ring-1 ring-[var(--is-border)]"
          >
            {initial}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-4">
          {user.bio?.trim() ? (
            <p className="max-w-2xl text-base leading-relaxed text-[var(--is-text-secondary)]">
              {user.bio.trim()}
            </p>
          ) : (
            <p className="text-sm text-[var(--is-muted)]">
              Este integrante del equipo todavía no cargó una bio pública.
            </p>
          )}
          {links.length > 0 ? (
            <ul className="flex flex-wrap gap-3">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-9 items-center rounded-[var(--is-radius-sm)] px-3 text-sm font-medium text-[var(--is-accent)] ring-1 ring-[var(--is-border)] hover:ring-[var(--is-accent)]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <section className="mt-12 space-y-6" aria-label="Notas del autor">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-[family-name:var(--font-source-serif)] text-2xl font-semibold tracking-tight">
            Notas publicadas
          </h2>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--is-accent)] hover:underline"
          >
            Ver todas
          </Link>
        </div>
        {articles.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--is-muted)]">
            Todavía no hay notas públicas de este autor.
          </p>
        )}
      </section>
    </PageShell>
  );
}
