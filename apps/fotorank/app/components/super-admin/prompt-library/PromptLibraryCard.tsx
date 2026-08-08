import Link from "next/link";
import type { PhotoPromptDifficulty, PhotoPromptStatus } from "@repo/photo-prompt-library";
import { routes } from "../../../lib/routes";
import { DIFFICULTY_LABELS, formatDateTime } from "./labels";
import { PromptStatusBadge } from "./PromptStatusBadge";

export type PromptLibraryCardItem = {
  id: string;
  title: string;
  description: string;
  theme: { name: string };
  subtheme?: { name: string } | null;
  inspirationLabel?: string | null;
  status: PhotoPromptStatus;
  difficulty: PhotoPromptDifficulty;
  universal: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
};

export function PromptLibraryCard({ item }: { item: PromptLibraryCardItem }) {
  const short =
    item.description.length > 160
      ? `${item.description.slice(0, 157).trimEnd()}…`
      : item.description;

  return (
    <Link
      href={routes.superAdmin.consigna(item.id)}
      className="fr-recuadro block space-y-4 border border-fr-border bg-fr-card transition-colors hover:border-gold/40"
      data-testid={`prompt-library-card-${item.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h3 className="font-semibold text-fr-primary">{item.title}</h3>
          <p className="text-sm text-fr-muted">
            {item.theme.name}
            {item.subtheme ? ` · ${item.subtheme.name}` : ""}
          </p>
        </div>
        <PromptStatusBadge status={item.status} />
      </div>
      <p className="text-sm leading-relaxed text-fr-muted">{short}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-fr-muted">
        <span>Dificultad: {DIFFICULTY_LABELS[item.difficulty]}</span>
        <span>{item.universal ? "Universal" : "No universal"}</span>
        {item.inspirationLabel ? <span>Inspiración: {item.inspirationLabel}</span> : null}
        <span>Usos: {item.usageCount}</span>
        <span>Último uso: {formatDateTime(item.lastUsedAt)}</span>
      </div>
    </Link>
  );
}
