import Image from "next/image";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  countClickatonerCandidates,
  ensureCurrentClickatoner,
  listClickatonerHistory,
  listEditionsForPublication,
  loadCurrentClickatoner,
} from "@/lib/clickatoner/repository";
import {
  pickClickatonerNowAction,
  setEditionResultsPublishedAction,
  skipClickatonerAction,
} from "@/lib/clickatoner/admin-actions";
import { clickatonerWeekLabel } from "@/lib/clickatoner/week";
import { fechaHoraLargaAr } from "@/lib/fecha-ar";

export const dynamic = "force-dynamic";

function esTablaAusente(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:table|relation).*does not exist|P2021/i.test(message);
}

type Props = { searchParams: Promise<{ ok?: string; error?: string }> };

/**
 * Clickatoner de la semana: el interruptor "Resultados publicados" de cada edición, quién salió
 * esta semana y el historial.
 */
export default async function AdminClickatonerPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;

  let faltaMigracion = false;
  let ediciones: Awaited<ReturnType<typeof listEditionsForPublication>> = [];
  let actual: Awaited<ReturnType<typeof loadCurrentClickatoner>> = null;
  let historia: Awaited<ReturnType<typeof listClickatonerHistory>> = [];
  let candidatos = 0;
  try {
    // Si la tarea horaria no corrió, abrir el panel elige. Un fallo de la elección no tira la pantalla.
    await ensureCurrentClickatoner().catch((error: unknown) => {
      if (esTablaAusente(error)) throw error;
      console.error("[clickaton][clickatoner] no se pudo elegir desde el panel:", error);
    });
    [ediciones, actual, historia, candidatos] = await Promise.all([
      listEditionsForPublication(),
      loadCurrentClickatoner(),
      listClickatonerHistory(),
      countClickatonerCandidates(),
    ]);
  } catch (error) {
    if (!esTablaAusente(error)) throw error;
    faltaMigracion = true;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Clickatoner de la semana"
        description="Cada viernes a las 00:00 se elige al azar, sin repetir, a alguien que corrió una maratón con resultados publicados. Se muestra en la portada con su mejor obra y un link a su perfil."
        breadcrumbs={[{ label: "Clickatoner de la semana" }]}
      />

      {params.error ? (
        <Card className="border-ck-danger/40 text-sm text-ck-text" role="alert">
          {params.error}
        </Card>
      ) : null}
      {params.ok ? (
        <Card className="text-sm text-ck-text" role="status">
          {params.ok}
        </Card>
      ) : null}

      {faltaMigracion ? (
        <Card className="space-y-2">
          <p className="font-medium text-ck-text">Falta crear las tablas en la base.</p>
          <p className="text-sm text-ck-text-secondary">
            Es la migración 20261006120000_clickaton_clickatoner_de_la_semana. Hasta aplicarla, la
            función no hace nada y la portada no cambia.
          </p>
        </Card>
      ) : (
        <>
          <Card variant="yellow" className="space-y-4">
            <p className="text-xs uppercase tracking-[0.08em] text-ck-text-muted">Esta semana</p>
            {actual ? (
              <div className="flex flex-wrap items-start gap-4">
                {actual.photoUrl ? (
                  <Image
                    src={actual.photoUrl}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full object-cover"
                    unoptimized
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-[family-name:var(--font-ck-display)] text-2xl text-ck-text">{actual.fullName}</p>
                  <p className="text-sm text-ck-text-secondary">
                    {clickatonerWeekLabel(actual.weekStart)}
                    {actual.place ? ` · ${actual.place}` : ""}
                  </p>
                  {actual.work ? (
                    <p className="text-sm text-ck-text-secondary">
                      Obra destacada: {actual.work.premioLabel ? `${actual.work.premioLabel} · ` : ""}
                      {actual.work.promptTitle ? `«${actual.work.promptTitle}» · ` : ""}
                      {actual.work.editionName}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button href="/#clickatoner" variant="outline" size="sm">
                      Ver en la portada
                    </Button>
                    {actual.profilePath ? (
                      <Button href={actual.profilePath} variant="outline" size="sm">
                        Ver su perfil
                      </Button>
                    ) : null}
                  </div>
                </div>
                {actual.work ? (
                  <Image
                    src={actual.work.imageUrl}
                    alt=""
                    width={320}
                    height={240}
                    className="h-auto w-48 rounded-md object-cover"
                    unoptimized
                  />
                ) : null}
              </div>
            ) : (
              <div className="space-y-3 text-sm text-ck-text-secondary">
                <p>
                  {candidatos === 0
                    ? "Todavía no hay nadie para elegir: hace falta al menos una edición con resultados publicados (abajo)."
                    : "Todavía no se eligió a nadie esta semana."}
                </p>
                {candidatos > 0 ? (
                  <form action={pickClickatonerNowAction}>
                    <Button type="submit" variant="primary" size="sm">
                      Elegir ahora
                    </Button>
                  </form>
                ) : null}
              </div>
            )}
            <p className="text-xs text-ck-text-muted">
              {candidatos} {candidatos === 1 ? "persona puede" : "personas pueden"} salir. Entran
              quienes participaron en una edición con resultados publicados, aceptaron las bases,
              tienen al menos una obra admitida y no pidieron quedar afuera desde Mi cuenta.
            </p>
            {actual ? (
              <details>
                <summary className="cursor-pointer text-sm text-ck-text-secondary underline underline-offset-4">
                  Saltear a esta persona
                </summary>
                <form action={skipClickatonerAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={actual.id} />
                  <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-ck-text-secondary">
                    Motivo (opcional)
                    <input
                      name="reason"
                      maxLength={200}
                      className="rounded-md border border-ck-border bg-ck-surface px-3 py-2 text-ck-text"
                    />
                  </label>
                  <Button type="submit" variant="outline" size="sm">
                    Saltear y elegir otra persona
                  </Button>
                </form>
              </details>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-medium text-ck-text">Resultados publicados</h2>
              <p className="text-sm text-ck-text-secondary">
                Prendelo cuando los resultados de una edición se anuncien. Recién ahí sus
                participantes entran en la rotación y sus obras se pueden ver en público, con sus
                premios. Apagarlo los saca en el acto.
              </p>
            </div>
            <ul className="divide-y divide-ck-border">
              {ediciones.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="space-y-0.5">
                    <p className="text-ck-text">{e.name}</p>
                    <p className="text-xs text-ck-text-muted">
                      {e.resultsPublishedAt
                        ? `Resultados publicados el ${fechaHoraLargaAr(e.resultsPublishedAt)}`
                        : "Resultados sin publicar"}
                    </p>
                  </div>
                  <form action={setEditionResultsPublishedAction}>
                    <input type="hidden" name="editionId" value={e.id} />
                    <input type="hidden" name="published" value={e.resultsPublishedAt ? "0" : "1"} />
                    <Button type="submit" variant={e.resultsPublishedAt ? "outline" : "secondary"} size="sm">
                      {e.resultsPublishedAt ? "Despublicar" : "Publicar resultados"}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>

          {historia.length > 0 ? (
            <Card className="space-y-3">
              <h2 className="font-medium text-ck-text">Historial</h2>
              <ul className="divide-y divide-ck-border text-sm">
                {historia.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className={h.skippedAt ? "text-ck-text-muted line-through" : "text-ck-text"}>
                      {h.name}
                    </span>
                    <span className="flex items-center gap-2 text-ck-text-muted">
                      {h.skippedAt ? <Badge variant="warning">Salteado{h.skipReason ? `: ${h.skipReason}` : ""}</Badge> : null}
                      {clickatonerWeekLabel(h.weekStart)} · vuelta {h.round}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
