import { ArticleListItem } from "@/components/redaccion/article-list-item";
import { RedaccionEmptyState } from "@/components/redaccion/redaccion-empty-state";
import type { ArticleWithRelations } from "@/lib/articles";
import type { RedaccionVista } from "@/lib/redaccion-queues";

type Props = {
  articles: ArticleWithRelations[];
  vista: RedaccionVista;
  canPublish: boolean;
  canCreate: boolean;
  isDirector?: boolean;
};

export function ArticleList({
  articles,
  vista,
  canPublish,
  canCreate,
  isDirector,
}: Props) {
  if (articles.length === 0) {
    return <RedaccionEmptyState vista={vista} canCreate={canCreate} />;
  }

  return (
    <ul className="space-y-3">
      {articles.map((article) => (
        <li key={article.id}>
          <ArticleListItem
            article={article}
            canPublish={canPublish}
            isDirector={isDirector}
          />
        </li>
      ))}
    </ul>
  );
}
