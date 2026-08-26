import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "../../../../../lib/auth";
import {
  AdmissionError,
  listAdmissionQueue,
  type AdmissionQueueFilter,
} from "../../../../../lib/fotorank/admission";
import { PageContainer } from "../../../../../components/PageContainer";
import { AdmissionFreezePanel } from "./AdmissionFreezePanel";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string; page?: string }>;
};

const FILTERS: Array<{ value: AdmissionQueueFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "requires_review", label: "Requiere revisión" },
  { value: "date_observed", label: "Fecha observada" },
  { value: "territory_observed", label: "Territorio observado" },
  { value: "device_observed", label: "Dispositivo observado" },
  { value: "argra_pending", label: "ARGRA pendiente" },
  { value: "drone_unidentified", label: "Dron no identificado" },
  { value: "possible_duplicate", label: "Posible duplicado" },
  { value: "evidence_requested", label: "Evidencia solicitada" },
  { value: "replacement_pending", label: "Reemplazo pendiente" },
  { value: "ready_to_admit", label: "Lista para admitir" },
  { value: "rejected", label: "Rechazada" },
  { value: "admitted", label: "Admitida" },
  { value: "frozen", label: "Congelada" },
];

function badgeClass(state: string): string {
  if (state === "ADMITTED" || state === "FROZEN") return "border-emerald-500/40 text-emerald-300";
  if (state === "REJECTED") return "border-red-500/40 text-red-300";
  if (state === "MANUAL_REVIEW_REQUIRED" || state === "EVIDENCE_REQUESTED")
    return "border-amber-500/40 text-amber-300";
  return "border-fr-border text-fr-muted";
}

export default async function ContestAdmissionQueuePage({ params, searchParams }: Props) {
  const user = await requireAuth();
  const { id: contestId } = await params;
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.value === sp.filter) ? sp.filter : "all") as AdmissionQueueFilter;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  let queue: Awaited<ReturnType<typeof listAdmissionQueue>>;
  try {
    queue = await listAdmissionQueue({
      contestId,
      organizerUserId: user.id,
      filter,
      page,
      pageSize: 25,
    });
  } catch (err) {
    if (err instanceof AdmissionError && err.code === "FORBIDDEN") redirect("/dashboard");
    if (err instanceof AdmissionError && err.code === "CONTEST_NOT_FOUND") notFound();
    throw err;
  }

  return (
    <PageContainer
      title="Cola de admisión técnica"
      description="Revisión operativa: una carga exitosa no implica admisión. Solo obras ADMITTED+FROZEN van al jurado."
    >
      <div className="mb-8 flex flex-wrap gap-4">
        <Link href={`/dashboard/concursos/${contestId}`} className="text-sm text-gold hover:text-gold-hover">
          ← Volver al concurso
        </Link>
        <Link
          href={`/dashboard/concursos/${contestId}/inscripciones`}
          className="text-sm text-fr-muted hover:text-gold"
        >
          Inscripciones
        </Link>
      </div>

      <AdmissionFreezePanel contestId={contestId} />

      <div className="fr-recuadro mt-10 border border-fr-border bg-fr-card space-y-6">
        <h2 className="text-lg font-semibold">Filtros</h2>
        <div className="flex flex-wrap gap-3" data-testid="admission-filters">
          {FILTERS.map((f) => {
            const href = `/dashboard/concursos/${contestId}/admision?filter=${f.value}`;
            const active = filter === f.value;
            return (
              <Link
                key={f.value}
                href={href}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  active
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-fr-border text-fr-muted hover:border-gold/50"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="fr-recuadro mt-10 overflow-x-auto border border-fr-border bg-fr-card">
        <table className="min-w-full text-left text-sm" data-testid="admission-queue-table">
          <thead className="border-b border-fr-border text-fr-muted">
            <tr>
              <th className="px-4 py-3">Obra</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Participante</th>
              <th className="px-4 py-3">Estados</th>
              <th className="px-4 py-3">Dispositivo</th>
              <th className="px-4 py-3">Territorio / fecha</th>
              <th className="px-4 py-3">ARGRA</th>
              <th className="px-4 py-3">Acción</th>
            </tr>
          </thead>
          <tbody>
            {queue.items.map((row) => (
              <tr key={row.entryId} className="border-b border-fr-border/60">
                <td className="px-4 py-3">
                  <div className="text-fr-primary">{row.entryNumber ?? row.entryId.slice(0, 8)}</div>
                  <div className="text-xs text-fr-muted">{row.submittedAt?.slice(0, 10) ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-fr-primary">{row.categoryName}</td>
                <td className="px-4 py-3">
                  <div className="text-fr-primary">{row.participantName ?? "—"}</div>
                  <div className="text-xs text-fr-muted">{row.participantEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded border px-2 py-1 text-xs ${badgeClass(row.logicalState)}`}>
                    {row.logicalState}
                  </span>
                  <div className="mt-2 text-xs text-fr-muted">
                    T:{row.technicalSummaryStatus} · M:{row.manualReviewStatus} · A:
                    {row.admissionStatus ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-fr-muted">
                  <div>{row.declaredDeviceKind ?? "—"}</div>
                  <div className="text-xs">{row.detectedDevice ?? "EXIF n/d"}</div>
                </td>
                <td className="px-4 py-3 text-fr-muted">
                  <div>{row.locality ?? "—"}</div>
                  <div className="text-xs">
                    {row.territoryStatus ?? "—"} · GPS: {row.gpsPresent ? "sí" : "no"}
                  </div>
                  <div className="text-xs">{row.captureWindowStatus ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-fr-muted">
                  {row.argraRedacted ?? "—"}
                  <div className="text-xs">{row.argraStatus}</div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/concursos/${contestId}/inscripciones/${row.entryId}`}
                    className="text-gold hover:text-gold-hover"
                  >
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
            {queue.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-fr-muted">
                  No hay obras para este filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-fr-border px-4 py-4 text-sm text-fr-muted">
          <span>
            Página {queue.page} · {queue.items.length} ítems (pageSize {queue.pageSize})
          </span>
          <div className="flex gap-3">
            {page > 1 ? (
              <Link
                href={`/dashboard/concursos/${contestId}/admision?filter=${filter}&page=${page - 1}`}
                className="text-gold"
              >
                Anterior
              </Link>
            ) : null}
            {queue.items.length >= queue.pageSize ? (
              <Link
                href={`/dashboard/concursos/${contestId}/admision?filter=${filter}&page=${page + 1}`}
                className="text-gold"
              >
                Siguiente
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
