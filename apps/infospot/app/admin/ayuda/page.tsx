import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { EditorialPublishManual } from "@/components/redaccion/editorial-publish-manual";
import { requireInfoSpotAdminAccess } from "@/lib/infospot-access";
import type { ManualOriginId } from "@/lib/editorial-publish-manual";

export const metadata: Metadata = {
  title: "Cómo publicar — Dirección",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ORIGIN_IDS = new Set<ManualOriginId>([
  "web-intake",
  "clf-event",
  "clf-coverage",
  "from-scratch",
]);

type Props = {
  searchParams: Promise<{ origen?: string }>;
};

export default async function AdminAyudaPage({ searchParams }: Props) {
  await requireInfoSpotAdminAccess();
  const params = await searchParams;
  const origenParam = params.origen;
  const initialOrigin =
    origenParam && ORIGIN_IDS.has(origenParam as ManualOriginId)
      ? (origenParam as ManualOriginId)
      : "clf-event";

  return (
    <PageShell
      title="Cómo publicar una historia"
      description="Manual operativo para la mesa de dirección: orígenes, aprobación y cierre."
    >
      <p className="mb-8 text-sm text-[var(--is-muted)]">
        También disponible en{" "}
        <Link
          href="/redaccion/ayuda"
          className="font-semibold text-[var(--is-accent)] underline-offset-2 hover:underline"
        >
          Redacción → Cómo publicar
        </Link>
        .
      </p>
      <EditorialPublishManual
        audience="director"
        initialOrigin={initialOrigin}
        showChromeHeader={false}
      />
    </PageShell>
  );
}
