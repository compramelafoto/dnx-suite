import type { Metadata } from "next";
import { RedaccionShell } from "@/components/redaccion/redaccion-shell";
import { NewsroomBreadcrumbs } from "@/components/redaccion/newsroom-breadcrumbs";
import { EditorialPublishManual } from "@/components/redaccion/editorial-publish-manual";
import {
  canManageInfoSpotSettings,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { NEWSROOM_COPY } from "@/lib/redaccion-ia";
import type { ManualOriginId } from "@/lib/editorial-publish-manual";

export const metadata: Metadata = {
  title: "Cómo publicar — Centro Editorial",
  robots: { index: false, follow: false },
};

const ORIGIN_IDS = new Set<ManualOriginId>([
  "web-intake",
  "clf-event",
  "clf-coverage",
  "from-scratch",
]);

type Props = {
  searchParams: Promise<{ origen?: string }>;
};

export default async function RedaccionAyudaPage({ searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  const params = await searchParams;
  const isDirector = canManageInfoSpotSettings(access.subject);
  const origenParam = params.origen;
  const initialOrigin =
    origenParam && ORIGIN_IDS.has(origenParam as ManualOriginId)
      ? (origenParam as ManualOriginId)
      : undefined;

  return (
    <RedaccionShell>
      <NewsroomBreadcrumbs
        items={[
          { label: NEWSROOM_COPY.newsroom, href: "/redaccion" },
          { label: NEWSROOM_COPY.howToPublish },
        ]}
      />
      <EditorialPublishManual
        audience={isDirector ? "both" : "redactor"}
        initialOrigin={initialOrigin}
      />
    </RedaccionShell>
  );
}
