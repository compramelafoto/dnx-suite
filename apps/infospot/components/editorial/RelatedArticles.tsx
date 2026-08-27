import Link from "next/link";
import { ArticleCardCompact } from "@/components/editorial/article-cards";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import type { ArticleWithRelations } from "@/lib/articles";

type Props = {
  articles: ArticleWithRelations[];
  title?: string;
  className?: string;
};

/** Relacionados: reutiliza ArticleCardCompact (adapter CMS). */
export function RelatedArticles({
  articles,
  title = "También te puede interesar",
  className,
}: Props) {
  if (articles.length === 0) return null;

  return (
    <section
      className={
        className ?? "mt-16 border-t border-[var(--is-border)] pt-12"
      }
    >
      <SectionHeader title={title} />
      <div className="grid gap-2 md:grid-cols-2 md:gap-8">
        {articles.map((article) => (
          <ArticleCardCompact key={article.id} article={article} />
        ))}
      </div>
      <p className="mt-8">
        <Link href="/" className="is-btn is-btn-ghost">
          Ver todas las noticias
        </Link>
      </p>
    </section>
  );
}
