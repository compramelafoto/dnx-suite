import Link from "next/link";
import { EditorialImage } from "@/components/editorial/EditorialImage";
import type { ArticleWithRelations } from "@/lib/articles";

type Props = {
  imageArticle?: ArticleWithRelations | null;
};

/**
 * Bloque visual de coberturas — institucional, sin CLF.
 */
export function HomeCoverageBlock({ imageArticle }: Props) {
  const cover = imageArticle?.coverImage;

  return (
    <section
      aria-labelledby="home-coverage-heading"
      className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12"
    >
      <div className="lg:col-span-6">
        {cover?.url ? (
          <EditorialImage
            src={cover.url}
            alt={
              cover.caption?.trim() ||
              imageArticle?.title ||
              "Cobertura fotográfica Info Spot"
            }
            caption={cover.caption}
            credit={cover.credit}
            photographerName={cover.photographerName}
            aspectRatio="feature"
            sizes="(max-width: 1024px) 100vw, 640px"
          />
        ) : (
          <div
            className="aspect-[16/10] rounded-[var(--is-radius-md)] bg-[var(--is-surface-muted)]"
            aria-hidden
          />
        )}
      </div>

      <div className="lg:col-span-6 lg:py-4">
        <p className="is-eyebrow">Coberturas</p>
        <h2 id="home-coverage-heading" className="is-h2 mt-3 text-2xl md:text-3xl">
          La fotografía como mirada editorial
        </h2>
        <p className="is-body mt-5 max-w-xl">
          Info Spot cubre eventos deportivos, culturales y sociales con una
          mirada fotográfica. Priorizamos la imagen, el crédito y el contexto
          de lo que pasa cerca tuyo.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/noticias" className="is-btn is-btn-primary min-h-11">
            Ver coberturas
          </Link>
          <Link href="/quienes-somos" className="is-btn is-btn-secondary min-h-11">
            Cómo trabajamos
          </Link>
        </div>
      </div>
    </section>
  );
}
