type Props = {
  name: string;
  description?: string | null;
  maxFiles?: number;
};

export function CategoryCard({ name, description, maxFiles }: Props) {
  return (
    <article className="fr-public-card h-full" data-testid="category-card">
      <h3 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{name}</h3>
      {description ? (
        <p className="fr-public-body fr-public-stack-title text-sm">{description}</p>
      ) : maxFiles != null ? (
        <p className="fr-public-body fr-public-stack-title text-sm">
          Hasta {maxFiles} obra{maxFiles === 1 ? "" : "s"} por participante.
        </p>
      ) : null}
    </article>
  );
}
