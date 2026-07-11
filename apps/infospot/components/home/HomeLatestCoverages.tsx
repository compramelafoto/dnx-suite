import Link from "next/link";
import { toArticleCardProps } from "@/components/editorial/article-cards";
import type { ArticleWithRelations } from "@/lib/articles";

type Props = {
  articles: ArticleWithRelations[];
};

/** Últimas coberturas — solo notas REAL con portada real (sin stock anónimo). */
export function HomeLatestCoverages({ articles }: Props) {
  const items = articles
    .slice(0, 5)
    .map((article) => {
      const card = toArticleCardProps(article, { forceEditorialStock: false });
      if (!card.imageUrl) return null;
      return {
        href: card.href,
        title: card.title,
        imageUrl: card.imageUrl,
        imageAlt: card.imageAlt || card.title,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (items.length === 0) {
    return (
      <section aria-labelledby="home-coverages-heading">
        <div className="mb-8 max-w-2xl md:mb-10">
          <p className="is-eyebrow">Mirada fotográfica</p>
          <h2
            id="home-coverages-heading"
            className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
          >
            Últimas coberturas
          </h2>
          <p className="is-body mt-3">
            Cuando publiquemos coberturas REAL con fotografía, van a aparecer
            acá. No mostramos imágenes de relleno en producción.
          </p>
        </div>
        <div className="rounded-[var(--is-radius)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-surface)] px-6 py-10 md:px-8">
          <p className="is-body max-w-xl">La galería editorial está por escribirse.</p>
          <p className="mt-6">
            <Link href="/noticias" className="is-btn is-btn-ghost min-h-11">
              Ir a noticias
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const [hero, ...rest] = items;

  return (
    <section aria-labelledby="home-coverages-heading">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="is-eyebrow">Mirada fotográfica</p>
          <h2
            id="home-coverages-heading"
            className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
          >
            Últimas coberturas
          </h2>
        </div>
        <Link href="/noticias" className="is-btn is-btn-ghost min-h-11 self-start">
          Ver más coberturas
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-12 md:gap-4">
        {hero ? (
          <Link
            href={hero.href}
            className="group relative overflow-hidden md:col-span-7 md:row-span-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hero.imageUrl}
              alt={hero.imageAlt}
              className="aspect-[4/5] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] md:aspect-auto md:h-full md:min-h-[30rem]"
              loading="lazy"
              draggable={false}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_78%,transparent)] to-transparent p-5 md:p-7">
              <h3 className="is-h3 text-xl text-[var(--is-white-0)] md:text-2xl lg:text-3xl">
                {hero.title}
              </h3>
            </div>
          </Link>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:col-span-5 md:grid-cols-1 md:gap-4">
          {rest.slice(0, 4).map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                index === 0
                  ? "group relative col-span-2 overflow-hidden md:col-span-1"
                  : "group relative overflow-hidden"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.imageAlt}
                className={
                  index === 0
                    ? "aspect-[16/10] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] md:aspect-[16/9]"
                    : "aspect-square w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] md:aspect-[16/11]"
                }
                loading="lazy"
                draggable={false}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[color-mix(in_oklab,var(--is-graphite-950)_70%,transparent)] to-transparent p-3 md:p-4">
                <h3 className="is-h4 text-sm leading-snug text-[var(--is-white-0)] md:text-base">
                  {item.title}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
