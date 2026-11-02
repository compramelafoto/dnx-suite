import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireRafflesConductor } from "@/lib/raffles/access";
import { fechaHora } from "@/lib/raffles/labels";
import { DEDUP_LABELS, currentWinners, parseDedupMode, parsePollKind, voteTotals, writtenAnswers } from "@/lib/live-raffles/rules";
import { appOrigin, publicPath, screenPath } from "@/lib/live-raffles/server";
import {
  addLiveRafflePollAction,
  addLiveRafflePrizeAction,
  addLiveRaffleSponsorAction,
  deleteLiveRaffleEntrantAction,
  deleteLiveRaffleRoundAction,
  deleteLiveRaffleSponsorAction,
  deleteLiveRafflePollAction,
  deleteLiveRafflePrizeAction,
  resetLiveRaffleDrawsAction,
  resetLiveRafflePrizeAction,
  rotateLiveRaffleScreenTokenAction,
  toggleLiveRafflePollAction,
  updateLiveRaffleAction,
} from "../actions";

export const dynamic = "force-dynamic";

const AVISOS: Record<string, string> = {
  guardado: "Cambios guardados.",
  premio: "Premio agregado.",
  encuesta: "Encuesta agregada.",
  enlace: "Enlace de pantalla renovado. El anterior ya no funciona.",
  sponsor: "Sponsor agregado.",
  reiniciado: "Se borraron todos los resultados.",
};

export default async function SorteoEnVivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireRafflesConductor();
  const { id } = await params;
  const aviso = await searchParams;

  const sorteo = await prisma.liveRaffle.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      prizes: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      polls: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { votes: { select: { optionIndex: true, text: true, createdAt: true } } },
      },
      sponsors: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      draws: { orderBy: [{ round: "asc" }, { createdAt: "asc" }] },
      entrants: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!sorteo) notFound();

  const origen = appOrigin();
  const urlPublica = `${origen}${publicPath(sorteo.publicCode)}`;
  const urlPantalla = `${origen}${screenPath(sorteo.publicCode, sorteo.screenToken)}`;
  const qr = await QRCode.toDataURL(urlPublica, { margin: 2, width: 1024 });
  const nombre = new Map(sorteo.entrants.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));
  const conDni = parseDedupMode(sorteo.dedupMode) === "CELULAR_DNI";
  const ganadores = currentWinners(sorteo.draws);
  const ganadorDePremio = new Map(ganadores.filter((d) => d.prizeId).map((d) => [d.prizeId as string, d.entrantId]));
  const premioPorId = new Map(sorteo.prizes.map((p) => [p.id, p.title]));

  return (
    <div className="space-y-8">
      <PageHeader
        title={sorteo.title}
        description={`${sorteo.entrants.length} inscriptos · ${sorteo.prizes.length} premios · ${sorteo.polls.length} encuestas`}
        actions={
          <Link href="/sorteos/en-vivo" className="fo-btn fo-btn-ghost text-sm">
            Volver
          </Link>
        }
      />

      {aviso.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {aviso.error}
        </p>
      ) : null}
      {aviso.ok ? <p className="fo-alert-success p-4 text-sm">{AVISOS[aviso.ok] ?? "Listo."}</p> : null}

      {/* Los dos enlaces y el QR */}
      <section className="fo-card grid gap-6 p-6 md:grid-cols-[14rem_1fr]">
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el servidor */}
          <img src={qr} alt="QR para anotarse" className="w-full rounded-md border border-[var(--fo-border)] bg-white" />
          <a href={qr} download={`qr-${sorteo.publicCode}.png`} className="fo-btn fo-btn-secondary w-full text-sm">
            Descargar QR
          </a>
        </div>
        <div className="space-y-5 text-sm">
          <div className="space-y-1">
            <p className="font-semibold">Página para anotarse (la del QR)</p>
            <p className="break-all text-[var(--fo-muted)]">{urlPublica}</p>
            <a href={urlPublica} target="_blank" rel="noreferrer" className="underline">
              Abrir
            </a>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Pantalla del sorteador (para el proyector)</p>
            <p className="text-[var(--fo-muted)]">
              Es un enlace secreto: quien lo tenga puede sortear sin iniciar sesión. Pasáselo solo a quien maneje la
              pantalla.
            </p>
            <p className="break-all text-[var(--fo-muted)]">{urlPantalla}</p>
            <div className="flex flex-wrap items-center gap-4">
              <a href={urlPantalla} target="_blank" rel="noreferrer" className="underline">
                Abrir pantalla
              </a>
              <form action={rotateLiveRaffleScreenTokenAction}>
                <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                <button type="submit" className="text-[var(--fo-muted)] underline">
                  Generar un enlace nuevo
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Configuración */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Configuración y condiciones</h2>
        <form action={updateLiveRaffleAction} className="fo-card space-y-6 p-6">
          <input type="hidden" name="liveRaffleId" value={sorteo.id} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="title">
              Nombre del sorteo
            </label>
            <input id="title" name="title" className="fo-input" required defaultValue={sorteo.title} />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="description">
              Texto de bienvenida
            </label>
            <textarea id="description" name="description" rows={2} className="fo-input" defaultValue={sorteo.description ?? ""} />
            <p className="fo-helper">Lo que ve la persona arriba del formulario. Puede quedar vacío.</p>
          </div>
          <div className="fo-field-stack">
            <span className="fo-label">Logo principal</span>
            <div className="flex flex-wrap items-center gap-4">
              {sorteo.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
                <img src={sorteo.logoUrl} alt="" className="h-14 w-auto rounded border border-[var(--fo-border)] bg-white object-contain p-1" />
              ) : null}
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
              {sorteo.logoUrl ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="removeLogo" /> Quitar logo
                </label>
              ) : null}
            </div>
            <p className="fo-helper">PNG, JPG o WebP de hasta 3 MB. El de la empresa u organizador del evento.</p>
          </div>

          <fieldset className="space-y-3">
            <legend className="fo-label">Para que nadie se anote dos veces</legend>
            {(["CELULAR", "CELULAR_DNI"] as const).map((modo) => (
              <label key={modo} className="flex items-start gap-2 text-sm">
                <input type="radio" name="dedupMode" value={modo} defaultChecked={sorteo.dedupMode === modo} className="mt-1" />
                <span>
                  <strong>{DEDUP_LABELS[modo]}</strong>
                  <span className="block text-[var(--fo-muted)]">
                    {modo === "CELULAR"
                      ? "No se acepta el mismo celular dos veces. Formulario más corto."
                      : "Además se pide el DNI, y tampoco se puede repetir. Más estricto."}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="fo-label">Cómo se sortea</legend>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="usePrizeList" value="si" defaultChecked={sorteo.usePrizeList} className="mt-1" />
              <span>
                <strong>Con listado de premios</strong>
                <span className="block text-[var(--fo-muted)]">Cada sorteo es de un premio de la lista, en orden.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="usePrizeList" value="no" defaultChecked={!sorteo.usePrizeList} className="mt-1" />
              <span>
                <strong>Sin listado</strong>
                <span className="block text-[var(--fo-muted)]">
                  Solo se aprieta &quot;Sortear&quot; y va saliendo un ganador por vez. La pantalla muestra la lista de resultados.
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="fo-label mb-2">Reglas</legend>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="maxWinsPerPerson">
                Máximo de premios por persona
              </label>
              <input id="maxWinsPerPerson" name="maxWinsPerPerson" type="number" min={0} max={100} className="fo-input" defaultValue={sorteo.maxWinsPerPerson} />
              <p className="fo-helper">1 = nadie gana dos veces. 0 = sin límite.</p>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="cooldownDraws">
                Sorteos de espera para volver a salir
              </label>
              <input id="cooldownDraws" name="cooldownDraws" type="number" min={0} max={1000} className="fo-input" defaultValue={sorteo.cooldownDraws} />
              <p className="fo-helper">
                Con 3, quien gana no puede volver a salir en los 3 sorteos siguientes. 0 = sin espera.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="registrationOpen" defaultChecked={sorteo.registrationOpen} />
              Inscripción abierta (si la desmarcás, el QR deja de aceptar inscripciones)
            </label>
          </fieldset>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="rulesText">
              Bases y condiciones
            </label>
            <textarea id="rulesText" name="rulesText" rows={6} className="fo-input" defaultValue={sorteo.rulesText ?? ""} />
            <p className="fo-helper">
              Si escribís algo acá, la persona tiene que aceptarlo para anotarse. Por ejemplo: quiénes pueden participar,
              que hay que estar presente, hasta cuándo se retira el premio.
            </p>
          </div>

          <div className="fo-form-actions">
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Guardar
            </button>
          </div>
        </form>
      </section>

      {/* Premios */}
      <section id="premios" className="space-y-3">
        <h2 className="text-lg font-semibold">Premios</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {sorteo.usePrizeList
            ? "Se sortean en este orden. Los logos de quienes donan también desfilan en el banner."
            : "Este sorteo está configurado sin listado: los premios no se usan para sortear, pero sus logos sí desfilan en el banner."}
        </p>
        {sorteo.prizes.length > 0 ? (
          <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {sorteo.prizes.map((p, i) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                <span className="w-6 text-[var(--fo-muted)] tabular-nums">{i + 1}.</span>
                {p.sponsorLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- logo subido a R2
                  <img src={p.sponsorLogoUrl} alt="" className="h-10 w-16 rounded bg-white object-contain p-1" />
                ) : null}
                <div className="min-w-[12rem] flex-1">
                  <p className="font-medium">{p.title}</p>
                  {p.sponsorName ? <p className="text-[var(--fo-muted)]">Dona: {p.sponsorName}</p> : null}
                  {ganadorDePremio.get(p.id) ? (
                    <p className="text-[var(--fo-success,#15803d)]">Ganó: {nombre.get(ganadorDePremio.get(p.id) as string) ?? "—"}</p>
                  ) : null}
                </div>
                {ganadorDePremio.get(p.id) ? (
                  <form action={resetLiveRafflePrizeAction}>
                    <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                    <input type="hidden" name="prizeId" value={p.id} />
                    <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                      Deshacer ganador
                    </button>
                  </form>
                ) : null}
                <form action={deleteLiveRafflePrizeAction}>
                  <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                  <input type="hidden" name="prizeId" value={p.id} />
                  <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addLiveRafflePrizeAction} className="fo-card grid gap-4 p-5 md:grid-cols-2">
          <input type="hidden" name="liveRaffleId" value={sorteo.id} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="prize-title">
              Premio
            </label>
            <input id="prize-title" name="title" className="fo-input" required placeholder="Un lente 50 mm" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="prize-sponsor">
              Quién lo dona
            </label>
            <input id="prize-sponsor" name="sponsorName" className="fo-input" placeholder="Casa de fotografía" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="prize-logo">
              Logo de quien lo dona
            </label>
            <input id="prize-logo" name="sponsorLogo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Agregar premio
            </button>
          </div>
        </form>
      </section>

      {/* Sponsors */}
      <section id="sponsors" className="space-y-3">
        <h2 className="text-lg font-semibold">Sponsors del banner</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Sus logos desfilan lentamente al pie de la pantalla del sorteador y de la página del QR.
        </p>
        {sorteo.sponsors.length > 0 ? (
          <ul className="fo-card flex flex-wrap gap-4 p-4">
            {sorteo.sponsors.map((sp) => (
              <li key={sp.id} className="flex flex-col items-center gap-2 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element -- logo subido a R2 */}
                <img src={sp.logoUrl} alt={sp.name ?? ""} className="h-14 w-28 rounded border border-[var(--fo-border)] bg-white object-contain p-1" />
                <span className="max-w-28 truncate text-[var(--fo-muted)]">{sp.name ?? "Sin nombre"}</span>
                <form action={deleteLiveRaffleSponsorAction}>
                  <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                  <input type="hidden" name="sponsorId" value={sp.id} />
                  <button type="submit" className="underline">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addLiveRaffleSponsorAction} className="fo-card grid gap-4 p-5 md:grid-cols-3">
          <input type="hidden" name="liveRaffleId" value={sorteo.id} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="sp-name">
              Nombre
            </label>
            <input id="sp-name" name="name" className="fo-input" placeholder="Marca" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="sp-logo">
              Logo
            </label>
            <input id="sp-logo" name="logo" type="file" required accept="image/png,image/jpeg,image/webp" className="text-sm" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Agregar sponsor
            </button>
          </div>
        </form>
      </section>

      {/* Resultados */}
      <section id="resultados" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Resultados ({ganadores.length})</h2>
          {sorteo.draws.length > 0 ? (
            <form action={resetLiveRaffleDrawsAction}>
              <input type="hidden" name="liveRaffleId" value={sorteo.id} />
              <button type="submit" className="fo-btn fo-btn-ghost text-sm">
                Borrar todos los resultados
              </button>
            </form>
          ) : null}
        </div>
        {ganadores.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no se sorteó nada. Se sortea desde la pantalla.</p>
        ) : (
          <ol className="fo-card divide-y divide-[var(--fo-border-muted)]">
            {ganadores.map((d, i) => (
              <li key={d.round} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <span className="w-8 text-[var(--fo-muted)] tabular-nums">{i + 1}.</span>
                <span className="flex-1 font-medium">{nombre.get(d.entrantId) ?? "—"}</span>
                {d.prizeId ? <span className="text-[var(--fo-muted)]">{premioPorId.get(d.prizeId)}</span> : null}
                <span className="text-xs text-[var(--fo-muted)]">{fechaHora(d.createdAt)}</span>
                <form action={deleteLiveRaffleRoundAction}>
                  <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                  <input type="hidden" name="round" value={d.round} />
                  <button type="submit" className="text-xs text-[var(--fo-muted)] underline">
                    Borrar
                  </button>
                </form>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Encuestas */}
      <section id="encuestas" className="space-y-3">
        <h2 className="text-lg font-semibold">Encuestas</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Las votan los inscriptos desde su celular, después de anotarse. Los resultados se ven en vivo en la pantalla.
        </p>
        {sorteo.polls.map((poll) => {
          const totales = voteTotals(poll.options.length, poll.votes);
          const total = poll.votes.length;
          const escritas = writtenAnswers(poll.votes);
          const esTexto = parsePollKind(poll.kind) === "TEXTO";
          return (
            <div key={poll.id} className="fo-card space-y-3 p-5 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-medium">
                  {poll.question}{" "}
                  <span className="font-normal text-[var(--fo-muted)]">
                    · {total} votos · {poll.isOpen ? "abierta" : "cerrada"}
                  </span>
                </p>
                <div className="flex gap-2">
                  <form action={toggleLiveRafflePollAction}>
                    <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                    <input type="hidden" name="pollId" value={poll.id} />
                    <input type="hidden" name="isOpen" value={poll.isOpen ? "false" : "true"} />
                    <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                      {poll.isOpen ? "Cerrar votación" : "Abrir votación"}
                    </button>
                  </form>
                  <form action={deleteLiveRafflePollAction}>
                    <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                    <input type="hidden" name="pollId" value={poll.id} />
                    <button type="submit" className="fo-btn fo-btn-ghost text-xs">
                      Borrar
                    </button>
                  </form>
                </div>
              </div>
              {esTexto ? null : (
              <ul className="space-y-1">
                {poll.options.map((o, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>{o}</span>
                    <span className="tabular-nums text-[var(--fo-muted)]">
                      {totales[i]} {total ? `(${Math.round((totales[i] / total) * 100)} %)` : ""}
                    </span>
                  </li>
                ))}
                {poll.allowOther ? (
                  <li className="flex justify-between gap-4">
                    <span>Otra</span>
                    <span className="tabular-nums text-[var(--fo-muted)]">{escritas.length}</span>
                  </li>
                ) : null}
              </ul>
              )}
              {escritas.length > 0 ? (
                <details className="rounded-md border border-[var(--fo-border)] p-3" open={esTexto}>
                  <summary className="cursor-pointer font-medium">
                    {esTexto ? `Respuestas (${escritas.length})` : `Lo que escribieron en "Otra" (${escritas.length})`}
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {escritas.map((t, i) => (
                      <li key={i} className="whitespace-pre-line border-l-2 border-[var(--fo-border)] pl-3 text-[var(--fo-text-secondary)]">
                        {t}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          );
        })}
        <form action={addLiveRafflePollAction} className="fo-card grid gap-4 p-5 md:grid-cols-2">
          <input type="hidden" name="liveRaffleId" value={sorteo.id} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="poll-q">
              Pregunta
            </label>
            <input id="poll-q" name="question" className="fo-input" required placeholder="¿Qué charla te gustó más?" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="poll-o">
              Opciones (una por renglón)
            </label>
            <textarea id="poll-o" name="options" rows={4} className="fo-input" />
            <p className="fo-helper">Si la pregunta es para escribir un párrafo, dejalo vacío.</p>
          </div>
          <fieldset className="space-y-2 text-sm md:col-span-2">
            <legend className="fo-label mb-1">Tipo de respuesta</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="OPCIONES" defaultChecked /> Elegir una opción
            </label>
            <label className="ml-6 flex items-center gap-2">
              <input type="checkbox" name="allowOther" /> Sumar la opción &quot;Otra&quot; para escribir una respuesta propia
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="TEXTO" /> Escribir un párrafo
            </label>
          </fieldset>
          <div>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Agregar encuesta
            </button>
          </div>
        </form>
      </section>

      {/* Inscriptos */}
      <section id="inscriptos" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Inscriptos ({sorteo.entrants.length})</h2>
          {sorteo.entrants.length > 0 ? (
            <a href={`/api/sorteos-en-vivo/${sorteo.id}/inscriptos`} className="fo-btn fo-btn-secondary text-sm">
              Descargar planilla
            </a>
          ) : null}
        </div>
        {sorteo.entrants.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no se anotó nadie.</p>
        ) : (
          <div className="fo-card overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-[var(--fo-muted)]">
                <tr className="border-b border-[var(--fo-border)]">
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Celular</th>
                  {conDni ? <th className="px-4 py-2 font-medium">DNI</th> : null}
                  <th className="px-4 py-2 font-medium">Correo</th>
                  <th className="px-4 py-2 font-medium">Se anotó</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {sorteo.entrants.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--fo-border-muted)] last:border-0">
                    <td className="px-4 py-2">
                      {e.firstName} {e.lastName}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{e.phone}</td>
                    {conDni ? <td className="px-4 py-2 tabular-nums">{e.dni ?? "—"}</td> : null}
                    <td className="px-4 py-2 text-[var(--fo-muted)]">{e.email ?? "—"}</td>
                    <td className="px-4 py-2 text-[var(--fo-muted)]">{fechaHora(e.createdAt)}</td>
                    <td className="px-4 py-2 text-right">
                      <form action={deleteLiveRaffleEntrantAction}>
                        <input type="hidden" name="liveRaffleId" value={sorteo.id} />
                        <input type="hidden" name="entrantId" value={e.id} />
                        <button type="submit" className="text-xs text-[var(--fo-muted)] underline">
                          Quitar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
