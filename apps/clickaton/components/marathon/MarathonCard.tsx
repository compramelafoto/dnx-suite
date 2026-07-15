import Link from "next/link";
import { PhotoFrame } from "@/components/content/PhotoFrame";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMarathonDateRange } from "@/lib/datetime";
import { marathonLocationLabel } from "@/lib/marathons";
import { routes } from "@/config/navigation";
import {
  marathonFormatLabels,
  marathonStatusLabels,
  registrationStatusLabels,
  type PublicMarathon,
} from "@/types/marathon";

type MarathonCardProps = {
  marathon: Pick<
    PublicMarathon,
    | "slug"
    | "name"
    | "shortDescription"
    | "status"
    | "registrationStatus"
    | "format"
    | "modality"
    | "city"
    | "provinceOrRegion"
    | "country"
    | "startAt"
    | "endAt"
    | "timezone"
    | "coverImage"
    | "featured"
  >;
};

/**
 * Card de listado con portada fotográfica opcional.
 * Sin coverImage → fallback editorial del sistema (no rompe layout).
 */
export function MarathonCard({ marathon }: MarathonCardProps) {
  const href = `${routes.marathons}/${marathon.slug}`;

  return (
    <Card
      as="article"
      variant="interactive"
      className="flex h-full flex-col overflow-hidden p-0"
    >
      <Link href={href} className="block focus-visible:outline-none">
        <PhotoFrame
          variant="card"
          src={marathon.coverImage}
          alt=""
          decorative
          className="rounded-none border-0 border-b border-ck-border"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {marathon.featured ? <Badge variant="brand">Destacada</Badge> : null}
          <Badge variant="neutral">{marathonStatusLabels[marathon.status]}</Badge>
          <Badge variant="warning">
            {registrationStatusLabels[marathon.registrationStatus]}
          </Badge>
        </div>
        <div>
          <h3 className="ck-heading-md">
            <Link
              href={href}
              className="transition-colors duration-[var(--ck-duration-base)] hover:text-ck-yellow"
            >
              {marathon.name}
            </Link>
          </h3>
          <p className="ck-body-sm mt-3 text-ck-text-secondary">
            {marathon.shortDescription}
          </p>
        </div>
        <dl className="mt-auto grid gap-3 text-sm">
          <div>
            <dt className="ck-label text-ck-text-muted">Territorio</dt>
            <dd className="mt-1 text-ck-text">{marathonLocationLabel(marathon)}</dd>
          </div>
          <div>
            <dt className="ck-label text-ck-text-muted">Fechas</dt>
            <dd className="mt-1 text-ck-text">
              {formatMarathonDateRange(marathon.startAt, marathon.endAt, marathon.timezone)}
            </dd>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <dt className="ck-label text-ck-text-muted">Formato</dt>
              <dd className="mt-1 text-ck-text">{marathonFormatLabels[marathon.format]}</dd>
            </div>
            <div>
              <dt className="ck-label text-ck-text-muted">Modalidad</dt>
              <dd className="mt-1 text-ck-text">{marathon.modality}</dd>
            </div>
          </div>
        </dl>
        <Button href={href} variant="secondary" className="mt-2 w-full sm:w-auto">
          Ver ficha
        </Button>
      </div>
    </Card>
  );
}
