"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Badge, IconButton, spacing } from "@repo/design-system";
import { formatDate } from "../../../lib/utils";
import { DeleteContestButton } from "./DeleteContestButton";
import { routes } from "../../../lib/routes";

interface ContestCardItem {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  status: string;
  categoriesCount: number;
  createdAt: Date;
}

interface ContestCardProps {
  contest: ContestCardItem;
  onEdit: (contestId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SETUP_IN_PROGRESS: "En configuración",
  READY_TO_PUBLISH: "Listo para publicar",
  PUBLISHED: "Publicado",
  ACTIVE: "Activo",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

function getBadgeVariant(status: string): "default" | "success" | "warning" | "neutral" {
  if (status === "PUBLISHED" || status === "ACTIVE" || status === "READY_TO_PUBLISH") return "success";
  if (status === "SETUP_IN_PROGRESS") return "warning";
  if (status === "DRAFT") return "neutral";
  return "default";
}

export function ContestCard({ contest, onEdit }: ContestCardProps) {
  const router = useRouter();

  return (
    <Card style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Link
        href={routes.dashboard.concursos.detalle(contest.id)}
        data-testid={`fotorank-contest-card-${contest.slug}`}
        className="block flex-1"
        style={{ padding: spacing[6], textDecoration: "none", color: "inherit" }}
      >
        <h3 className="font-sans text-xl font-semibold text-fr-primary">{contest.title}</h3>

        {contest.shortDescription ? (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-fr-muted">
            {contest.shortDescription}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={getBadgeVariant(contest.status)}>
            {STATUS_LABELS[contest.status] ?? contest.status}
          </Badge>
          <span className="text-fr-muted">{contest.categoriesCount} categorías</span>
        </div>

        <p className="mt-4 text-xs text-fr-muted-soft">{formatDate(contest.createdAt)}</p>
      </Link>

      <div
        className="flex flex-wrap items-center gap-2 border-t border-white/10"
        style={{ padding: spacing[4] }}
        onClick={(e) => e.stopPropagation()}
      >
        <IconButton
          icon="edit"
          variant="outline"
          size="sm"
          aria-label={`Editar concurso ${contest.title}`}
          onClick={() => onEdit(contest.id)}
          title="Editar"
        />

        <IconButton
          icon="eye"
          variant="secondary"
          size="sm"
          aria-label={`Ver concurso ${contest.title}`}
          onClick={() => router.push(routes.dashboard.concursos.detalle(contest.id))}
          title="Ver"
        />

        <IconButton icon="more" variant="ghost" size="sm" aria-label="Más acciones (próximamente)" disabled />

        <DeleteContestButton
          contestId={contest.id}
          contestTitle={contest.title}
          iconOnly
          className="px-3"
        />
      </div>
    </Card>
  );
}
