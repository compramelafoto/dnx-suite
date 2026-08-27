/**
 * Imágenes del concurso.
 *
 * Reemplaza el circuito anterior, en el que cambiar el banner de un concurso
 * exigía dejar el archivo en `public/contest-assets/`, tocar un manifiesto
 * TypeScript y desplegar.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "../../../../../components/PageContainer";
import { getAuthUser } from "../../../../../lib/auth";
import {
  CONTEST_MEDIA_SPECS,
  contestMediaIsPubliclyVisible,
  contestMediaUrl,
  getActiveContestMedia,
  listContestMediaHistory,
  resolveContestMediaAccess,
  type ContestMediaKind,
} from "../../../../../lib/fotorank/contest-media";
import { routes } from "../../../../../lib/routes";
import { ContestMediaPanel, type ExistingMedia } from "./ContestMediaPanel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("es-AR", DATE_FORMAT).format(value);
}

export default async function ContestImagenesPage({ params }: PageProps) {
  const { id } = await params;

  /**
   * El permiso se resuelve acá y no en el componente: una persona que no es
   * miembro de la organización no debe ver siquiera el nombre del concurso.
   */
  const user = await getAuthUser();
  const access = await resolveContestMediaAccess(user, id);
  if (!access || access.deniedReason === "not_a_member") {
    notFound();
  }

  if (!access.canManage) {
    return (
      <PageContainer
        title="Imágenes del concurso"
        description="No tenés permiso para cambiar las imágenes de este concurso."
      >
        <div className="rounded-lg border border-fr-border bg-fr-card p-5">
          <p className="fr-body text-sm text-fr-muted">
            Tu rol en la organización permite ver el concurso, pero no modificar su presentación.
            Pedile a quien administra la organización que te asigne el rol de editor.
          </p>
          <Link
            href={routes.dashboard.concursos.detalle(id)}
            className="fr-btn fr-btn-secondary mt-4 inline-flex w-fit"
          >
            Volver al concurso
          </Link>
        </div>
      </PageContainer>
    );
  }

  const [active, history] = await Promise.all([
    getActiveContestMedia(id),
    listContestMediaHistory(id),
  ]);

  const existing: Partial<Record<ContestMediaKind, ExistingMedia>> = {};
  for (const [kind, record] of Object.entries(active)) {
    if (!record) continue;
    existing[kind as ContestMediaKind] = {
      id: record.id,
      url: contestMediaUrl(id, record.id),
      altText: record.altText,
      width: record.width,
      height: record.height,
      fileSizeBytes: record.fileSizeBytes,
      focalPointX: record.focalPointX,
      focalPointY: record.focalPointY,
      uploadedAtLabel: formatDate(record.uploadedAt),
      uploadedByName: record.uploadedByName,
    };
  }

  const isDraft = !contestMediaIsPubliclyVisible(access.contestStatus);

  return (
    <PageContainer
      title={`Imágenes: ${access.contestTitle}`}
      description="Cargá y reemplazá las imágenes del concurso. Los cambios se ven al instante, sin desplegar."
    >
      <ContestMediaPanel
        contestId={id}
        contestTitle={access.contestTitle}
        isDraft={isDraft}
        existing={existing}
        history={history.map((h) => ({
          id: h.id,
          kindLabel: CONTEST_MEDIA_SPECS[h.kind].label,
          uploadedAtLabel: formatDate(h.uploadedAt),
          uploadedByName: h.uploadedByName,
          isActive: h.isActive,
          wasDeleted: Boolean(h.replacedAt) && !h.isActive,
        }))}
      />

      <div className="mt-6">
        <Link
          href={routes.dashboard.concursos.detalle(id)}
          className="fr-btn fr-btn-secondary inline-flex w-fit"
        >
          Volver al concurso
        </Link>
      </div>
    </PageContainer>
  );
}
