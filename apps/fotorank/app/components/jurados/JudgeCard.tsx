import type { ReactNode } from "react";
import Link from "next/link";

import { StatusBadge } from "../public-ui";
import type { PresentedStatus } from "../../lib/fotorank/judges/ui/judgeStatus";
import { fechaExacta, tiempoRelativo } from "../../lib/fotorank/judges/ui/tiempoRelativo";

/**
 * La tarjeta de un jurado, siempre la misma.
 *
 * Antes cada pantalla armaba la suya: una mostraba el email como título, otra
 * el estado crudo, otra la fecha con segundos.
 */
export function JudgeCard({
  nombre,
  titular,
  email,
  avatarSrc,
  estado,
  ultimaActividad,
  etiquetaDeActividad = "Entró",
  acciones,
  href,
  children,
}: {
  nombre: string;
  titular?: string | null;
  email?: string | null;
  avatarSrc: string | null;
  estado?: PresentedStatus;
  ultimaActividad?: Date | null;
  etiquetaDeActividad?: string;
  acciones?: ReactNode;
  href?: string;
  children?: ReactNode;
}) {
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const encabezado = (
    <div className="flex min-w-0 items-start gap-3">
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full border border-fr-border object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-fr-border bg-fr-bg text-sm font-semibold text-fr-muted">
          {iniciales || "—"}
        </div>
      )}

      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-fr-primary">{nombre}</p>
        {titular ? <p className="truncate text-sm text-fr-muted">{titular}</p> : null}
        {email ? <p className="truncate text-xs text-fr-muted">{email}</p> : null}
      </div>
    </div>
  );

  return (
    <article className="fr-recuadro border border-fr-border bg-fr-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {href ? (
          <Link href={href} className="min-w-0 flex-1 transition-opacity hover:opacity-80">
            {encabezado}
          </Link>
        ) : (
          <div className="min-w-0 flex-1">{encabezado}</div>
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {estado ? (
            <span title={estado.description}>
              <StatusBadge label={estado.label} tone={estado.tone} />
            </span>
          ) : null}
          {acciones}
        </div>
      </div>

      {ultimaActividad !== undefined ? (
        <p className="mt-3 text-xs text-fr-muted" title={fechaExacta(ultimaActividad)}>
          {etiquetaDeActividad} {tiempoRelativo(ultimaActividad)}
        </p>
      ) : null}

      {children ? <div className="mt-3">{children}</div> : null}
    </article>
  );
}
