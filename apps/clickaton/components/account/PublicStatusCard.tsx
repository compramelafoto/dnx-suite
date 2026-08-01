import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  publicToneToBadgeVariant,
  type PublicStatusPresentation,
} from "@/lib/public-ux/status-presentation";
import { cn } from "@/lib/cn";

type Props = {
  presentation: PublicStatusPresentation;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Región anunciable para lectores de pantalla. */
  live?: boolean;
};

/**
 * Tarjeta principal de estado para experiencia pública (Mi cuenta / postpago).
 * Una sola tarjeta: estado + explicación + próximo paso + acciones.
 */
export function PublicStatusCard({
  presentation,
  title = "Estado de tu inscripción",
  children,
  actions,
  className,
  live = true,
}: Props) {
  return (
    <Card
      variant="outlined"
      className={cn("space-y-4 border-ck-yellow/35 p-6", className)}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-ck-text">{title}</h2>
          <Badge variant={publicToneToBadgeVariant(presentation.tone)}>
            {presentation.label}
          </Badge>
        </div>
        <div
          className="space-y-2"
          {...(live ? { role: "status", "aria-live": "polite" as const } : {})}
        >
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            {presentation.description}
          </p>
          {presentation.nextAction ? (
            <p className="text-sm font-medium leading-relaxed text-ck-text">
              Próximo paso: {presentation.nextAction}
            </p>
          ) : null}
        </div>
      </div>
      {children}
      {actions ? (
        <div className="flex w-full flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      ) : null}
    </Card>
  );
}
