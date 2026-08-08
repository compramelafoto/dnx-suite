import type { LibraryKpis } from "@repo/photo-prompt-library";

const ITEMS: { key: keyof LibraryKpis; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "draft", label: "Borradores" },
  { key: "inReview", label: "En revisión" },
  { key: "approved", label: "Aprobadas" },
  { key: "archived", label: "Archivadas" },
  { key: "used", label: "Utilizadas" },
  { key: "neverUsed", label: "Nunca utilizadas" },
];

export function PromptLibraryKpis({ kpis }: { kpis: LibraryKpis }) {
  return (
    <section
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
      data-testid="prompt-library-kpis"
    >
      {ITEMS.map(({ key, label }) => (
        <div key={key} className="fr-recuadro border border-fr-border bg-fr-card">
          <p className="text-xs uppercase tracking-wide text-fr-muted">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-gold">{kpis[key]}</p>
        </div>
      ))}
    </section>
  );
}
