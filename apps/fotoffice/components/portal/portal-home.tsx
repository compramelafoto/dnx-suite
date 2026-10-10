import Link from "next/link";
import { ContestCarousel } from "@/components/contests/contest-carousel";
import type { ShowcaseItem } from "@/lib/contests/showcase";
import { createOwnBusinessAction, switchProfileAction } from "@/app/actions/profile-choice";
import type { MemberBalance } from "@/lib/membership/balance";
import { formatMinorArs } from "@/lib/membership/money";
import { recommendationBenefitPhrase } from "@/lib/membership/recommendation-labels";
import {
  chargeConceptLabel,
  chargePeriodLabel,
  isOpeningBalance,
} from "@/lib/membership/charge-labels";
import type { ResolvedPortalItem } from "@/lib/portal/menu";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { aplicarVocabulario } from "@/lib/vocabulario/plantilla";
import { PortalIcon } from "./portal-icon";
import { PortalAvatar } from "./portal-shell";
import type { PortalRaffleView } from "@/lib/raffles/portal";
import { fechaHora } from "@/lib/raffles/labels";
import { PrizeCards } from "@/components/raffles/prize-cards";
import { WhatsappGroupButton } from "@/components/brand/whatsapp-group-button";
import { SpotlightCard } from "@/components/spotlight/spotlight-card";
import type { SpotlightCardView } from "@/lib/spotlight/view";
import { BirthdaysCard } from "@/components/birthdays/birthdays-card";
import type { BirthdayView } from "@/lib/birthdays/week";
import { MuestrasCercaCard } from "@/components/portal/muestras-cerca-card";
import type { MuestrasCerca } from "@/lib/muestras/cerca";

export type PortalHomeProps = {
  institution: string;
  member: {
    firstName: string;
    fullName: string;
    memberNumber: string;
    categoryName: string | null;
    photoUrl: string | null;
    /** Nombre de su estudio o empresa, si lo cargó en su perfil. */
    businessName: string | null;
    /** Logo de esa empresa, si lo subió en Mi perfil. */
    businessLogoUrl: string | null;
  };
  antiguedad: { desde: string | null; anios: number | null };
  cuenta: Pick<MemberBalance, "charges" | "dueMinor" | "overdueCount">;
  faltaFoto: boolean;
  secciones: ResolvedPortalItem[];
  vocabulary: PersonVocabulary;
  /** Porcentaje del beneficio por recomendar, o null si la sección no está disponible. */
  recommendationBenefitPercent: number | null;
  perfilVacio: boolean;
  puedeCambiarPerfil: boolean;
  tieneNegocio: boolean;
  /** El sorteo abierto, si hay uno y el módulo está prendido. */
  sorteo: PortalRaffleView | null;
  /** El grupo de WhatsApp de los socios, si la institución cargó uno. */
  whatsappGroupUrl?: string | null;
  /** El Socio de la semana, si Comunicación está prendido y hay uno. */
  socioDeLaSemana?: { card: SpotlightCardView; weekLabel: string } | null;
  /** Los socios que cumplen años esta semana (lunes a domingo). */
  cumpleanos?: BirthdayView[];
  /** Proyectos de la comisión: invitar a proponer y a tomar tareas sin responsable. */
  /** La vitrina de concursos (FotoRank y Clickatón): lo abierto y lo que viene. */
  concursos?: ShowcaseItem[];
  /** Muestras fotográficas cerca del socio (muestrasfotograficas.com). */
  muestrasCerca?: MuestrasCerca | null;
  gobierno?: {
    tareasLibres: { id: string; title: string; projectTitle: string; dueAt: Date | null }[];
    totalLibres: number;
  } | null;
};

/**
 * La portada del portal, como tablero: indicadores arriba (cuenta, carnet, categoría,
 * antigüedad), las cuotas y los atajos a la izquierda, el carnet y los avisos a la derecha.
 *
 * Está separada de la página para que el dibujo no dependa de la base: la página junta los
 * datos y esto solo los muestra.
 */
export function PortalHome({
  institution,
  member,
  antiguedad,
  cuenta,
  faltaFoto,
  secciones,
  vocabulary: v,
  recommendationBenefitPercent,
  perfilVacio,
  puedeCambiarPerfil,
  tieneNegocio,
  sorteo,
  whatsappGroupUrl,
  socioDeLaSemana,
  cumpleanos = [],
  gobierno = null,
  concursos = [],
  muestrasCerca = null,
}: PortalHomeProps) {
  const cuotasPendientes = cuenta.charges.filter((c) => !isOpeningBalance(c.period));
  const alDia = cuenta.charges.length === 0;
  const nombreCompleto = member.fullName;
  // La portada no repite el panel lateral: estos son atajos para el teléfono, donde la barra
  // inferior solo muestra cuatro secciones.
  const accesos = secciones.filter((s) => s.state === "DISPONIBLE" && s.href !== "/portal");
  const proximas = secciones.filter((s) => s.state === "PROXIMAMENTE");

  const cuotasCard = (
          <section className="fo-card space-y-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">Tus cuotas</h2>
              {alDia ? null : (
                <p className="text-2xl font-semibold tabular-nums">{formatMinorArs(cuenta.dueMinor)}</p>
              )}
            </div>

            {alDia ? (
              <div className="flex items-start gap-3 rounded-[var(--fo-radius-sm)] bg-[var(--fo-success-soft)] p-4">
                <span className="text-[var(--fo-success)]">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.5l2.5 2.5L16 9.5" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--fo-success)]">Estás al día</p>
                  <p className="text-sm text-[var(--fo-muted)]">
                    No tenés cuotas pendientes con {institution}.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {cuenta.overdueCount > 0 ? (
                  <p className="text-sm text-[var(--fo-danger)]">
                    {cuenta.overdueCount === 1
                      ? "Tenés 1 cuota vencida."
                      : `Tenés ${cuenta.overdueCount} cuotas vencidas.`}
                  </p>
                ) : null}
                {cuotasPendientes.length > 0 ? (
                  <ul className="divide-y divide-[var(--fo-border)]">
                    {cuotasPendientes.slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm">{chargePeriodLabel(c.period)}</p>
                          <p className="text-xs text-[var(--fo-muted-soft)]">
                            {chargeConceptLabel(c.concept, c.period)}
                          </p>
                        </div>
                        <p className="text-sm font-medium tabular-nums">
                          {formatMinorArs(c.balanceMinor)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {cuotasPendientes.length > 4 ? (
                  <p className="text-xs text-[var(--fo-muted)]">
                    Y {cuotasPendientes.length - 4} más.
                  </p>
                ) : null}
              </>
            )}

            <Link
              href="/portal/cuotas"
              className={`fo-btn ${alDia ? "fo-btn-secondary" : "fo-btn-primary"} inline-flex w-full justify-center text-sm sm:w-auto`}
            >
              {alDia ? "Ver mis pagos" : "Ver y pagar"}
            </Link>
          </section>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/portal/perfil" aria-label="Cambiar mi foto" className="shrink-0">
          <PortalAvatar name={member.fullName} src={member.photoUrl} className="h-16 w-16 text-lg sm:h-20 sm:w-20" />
        </Link>
        <div className="min-w-0">
          <p className="text-sm text-[var(--fo-muted)]">{institution}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {member.firstName}</h1>
          {member.businessName || member.businessLogoUrl ? (
            <div className="mt-1 flex min-w-0 items-center gap-2">
              {member.businessLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2, fuera del build
                <img
                  src={member.businessLogoUrl}
                  alt={member.businessName ?? "Logo de tu empresa"}
                  className="h-8 w-auto max-w-28 shrink-0 rounded bg-white object-contain"
                />
              ) : null}
              {member.businessName ? (
                <p className="truncate text-sm font-medium text-[var(--fo-text-secondary)]">
                  {member.businessName}
                </p>
              ) : null}
            </div>
          ) : member.photoUrl ? null : (
            <Link href="/portal/perfil" className="text-xs text-[var(--fo-accent-hover)] hover:underline">
              Subí tu foto
            </Link>
          )}
        </div>
      </div>

      {/*
        Los accesos van arriba de todo y en una sola fila: es lo que el socio viene a buscar. En el
        teléfono la fila se desliza de costado en vez de partirse en renglones.
      */}
      {accesos.length > 0 ? (
        <nav aria-label="Accesos directos" className="-mx-1 overflow-x-auto px-1 pb-1">
          <ul className="flex gap-2 lg:grid lg:auto-cols-fr lg:grid-flow-col">
            {accesos.map((s) => (
              <li key={s.href} className="w-24 shrink-0 lg:w-auto">
                <Link
                  href={s.href}
                  className="flex h-full flex-col items-center gap-2 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] px-2 py-3 text-center text-xs font-medium transition-colors hover:border-[var(--fo-accent)] hover:text-[var(--fo-accent-hover)]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]">
                    <PortalIcon name={s.icon} />
                  </span>
                  {aplicarVocabulario(s.label, v)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/*
        Identidad antes que trámite: lo primero que ve el socio es que la institución sabe quién
        es. Son datos que ya existen en la ficha, así que nunca quedan desactualizados.
      */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Tu cuenta"
          valor={alDia ? "Al día" : formatMinorArs(cuenta.dueMinor)}
          tono={alDia ? "success" : cuenta.overdueCount > 0 ? "danger" : "warning"}
          detalle={
            alDia
              ? "Sin cuotas pendientes"
              : cuenta.overdueCount > 0
                ? `${cuenta.overdueCount} ${cuenta.overdueCount === 1 ? "cuota vencida" : "cuotas vencidas"}`
                : "Pendiente de pago"
          }
        />
        <Indicador
          rotulo="Carnet"
          valor={faltaFoto ? "Falta tu foto" : "Vigente"}
          tono={faltaFoto ? "warning" : "success"}
          detalle={faltaFoto ? "Para emitir la impresa" : `Acredita que sos ${v.singular}`}
        />
        <Indicador
          rotulo="Categoría"
          valor={member.categoryName ?? "—"}
          detalle={`${v.Singular} N° ${member.memberNumber}`}
        />
        <Indicador
          rotulo="Antigüedad"
          valor={
            antiguedad.anios
              ? `${antiguedad.anios} ${antiguedad.anios === 1 ? "año" : "años"}`
              : "Menos de 1 año"
          }
          detalle={antiguedad.desde ? `Desde ${antiguedad.desde}` : null}
        />
      </div>

      {/*
        Orden de prioridad: primero lo que le pide algo al socio (una deuda), después participar
        (ayudar, el sorteo) y al final la comunidad (socio de la semana, cumpleaños).
      */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {alDia ? null : cuotasCard}

          {/* Sólo cuando hay algo para tomar: si no, la tarjeta no le pide nada al socio. */}
          {gobierno && gobierno.totalLibres > 0 ? (
            <section className="space-y-3 rounded-[var(--fo-radius)] border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-5">
              <h2 className="text-base font-semibold">Tareas a realizar en {institution}: ¡necesitamos tu ayuda!</h2>
              <p className="text-sm leading-relaxed text-[var(--fo-text-secondary)]">
                {gobierno.totalLibres === 1
                  ? "Hay una tarea que todavía no tiene a nadie a cargo."
                  : `Hay ${gobierno.totalLibres} tareas que todavía no tienen a nadie a cargo.`}
              </p>
              <ul className="space-y-1 text-sm">
                {gobierno.tareasLibres.map((t) => (
                  <li key={t.id}>
                    <span className="font-medium">{t.title}</span>
                    <span className="text-[var(--fo-muted)]"> · {t.projectTitle}</span>
                  </li>
                ))}
              </ul>
              <Link href="/portal/tareas#ayudar" className="fo-btn fo-btn-primary inline-flex text-sm">
                Quiero ayudar
              </Link>
            </section>
          ) : null}

          {sorteo ? <TarjetaSorteo sorteo={sorteo} /> : null}

          {alDia ? cuotasCard : null}

          {socioDeLaSemana ? (
            <SpotlightCard
              card={socioDeLaSemana.card}
              weekLabel={socioDeLaSemana.weekLabel}
              audience="portal"
            />
          ) : null}

          <BirthdaysCard birthdays={cumpleanos} />

        </div>

        <div className="space-y-6">
          {/* Una muestra del carnet: se reconoce de un vistazo y lleva directo a la credencial. */}
          <Link
            href="/portal/carnet"
            className="block overflow-hidden rounded-[var(--fo-radius)] bg-gradient-to-br from-[var(--fo-accent)] to-[var(--fo-accent-hover)] p-5 text-white shadow-[var(--fo-shadow-md)] transition-transform hover:-translate-y-0.5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-white/80">
              Carnet de {v.singular}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <PortalAvatar
                name={nombreCompleto}
                src={member.photoUrl}
                className="h-14 w-14 border-white/40"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold">{nombreCompleto}</p>
                <p className="text-sm text-white/85">
                  N° <span className="tabular-nums">{member.memberNumber}</span>
                  {member.categoryName ? ` · ${member.categoryName}` : ""}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">
              {faltaFoto ? "Te falta subir tu foto →" : "Ver mi carnet →"}
            </p>
          </Link>

          {faltaFoto ? (
            <p className="-mt-3 text-xs leading-relaxed text-[var(--fo-warning)]">
              Ya pagaste tu credencial impresa. Sin tu foto no la podemos emitir.
            </p>
          ) : null}

          {/*
            Los socios del padrón migrado llegan sin estos datos: nunca hubo un formulario donde
            cargarlos. El aviso desaparece solo cuando ya cargó algo.
          */}
          {perfilVacio ? (
            <section className="fo-card space-y-2 p-5">
              <h2 className="text-sm font-semibold">Completá tu perfil profesional</h2>
              <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                Contanos a qué te dedicás y dónde se ve tu trabajo. Es lo que {institution} usa
                para recomendarte. Se publica solo si lo autorizás.
              </p>
              <Link href="/portal/perfil" className="fo-btn fo-btn-secondary inline-flex text-sm">
                Completar mi perfil
              </Link>
            </section>
          ) : null}

          {gobierno ? (
          <section className="space-y-2 rounded-[var(--fo-radius)] border border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] p-5">
            <h2 className="text-sm font-semibold">Proponé tus proyectos</h2>
            <p className="text-sm leading-relaxed text-[var(--fo-text-secondary)]">
              ¿Tenés una idea para {institution}? Una muestra, un taller, una salida. Contala y la comisión directiva la
              trata en su próxima reunión.
            </p>
            <Link href="/portal/proyectos/proponer" className="fo-btn fo-btn-primary inline-flex text-sm">
              Proponer un proyecto
            </Link>
          </section>

          ) : null}

          {/*
            Solo se muestra cuando la sección está realmente disponible: los dos interruptores
            —módulo de socios y beneficio resuelto por la comisión— ya los resolvió el menú.
          */}
          {recommendationBenefitPercent !== null ? (
            <section className="space-y-2 rounded-[var(--fo-radius)] border border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] p-5">
              <h2 className="text-sm font-semibold">Recomendá a un fotógrafo amigo</h2>
              <p className="text-sm leading-relaxed text-[var(--fo-text-secondary)]">
                Por cada colega que se asocie a {institution} con tu enlace y pague su ingreso,
                ganás {recommendationBenefitPhrase(recommendationBenefitPercent)}.
                Sin tope.
              </p>
              <Link href="/portal/recomendados" className="fo-btn fo-btn-primary inline-flex text-sm">
                Recomendar a un amigo
              </Link>
            </section>
          ) : null}

          {whatsappGroupUrl ? (
            <div className="fo-card flex flex-col gap-3 p-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--fo-text)]">{`El grupo de ${v.plural} de ${institution}`}</p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {`Novedades, convocatorias y charlas entre ${v.plural}, en WhatsApp.`}
                </p>
              </div>
              <WhatsappGroupButton href={whatsappGroupUrl} className="self-start" />
            </div>
          ) : null}

          {muestrasCerca ? <MuestrasCercaCard muestras={muestrasCerca} /> : null}

          {/*
            Los concursos van en la columna lateral, de a una ficha que va pasando sola: muestra
            todo lo abierto sin ocupar una fila entera. "Ver más" lleva a la lista completa.
          */}
          {concursos.length > 0 ? (
            <section className="space-y-3" aria-label="Concursos fotográficos">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">Concursos fotográficos</h2>
                <Link href="/portal/concursos" className="text-sm text-[var(--fo-accent-hover)] hover:underline">
                  Ver más →
                </Link>
              </div>
              <ContestCarousel items={concursos} institution={institution} now={new Date()} />
            </section>
          ) : null}

          {/*
            Lo que viene se muestra en vez de esconderse: el socio entra cada tanto y lo que
            necesita saber es qué le da la institución por su cuota. Lo que viene es parte de eso.
          */}
          {proximas.length > 0 ? (
            <section className="fo-card space-y-3 p-5">
              <div>
                <h2 className="text-sm font-semibold">Próximas funcionalidades</h2>
                <p className="text-xs text-[var(--fo-muted)]">
                  Se están construyendo. Te avisamos acá cuando se habiliten.
                </p>
              </div>
              <ul className="space-y-3">
                {proximas.map((s) => (
                  <li key={s.href} className="flex items-start gap-3">
                    <span className="mt-0.5 text-[var(--fo-muted-soft)]">
                      <PortalIcon name={s.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--fo-text-secondary)]">
                        {aplicarVocabulario(s.label, v)}
                      </span>
                      <span className="block text-xs leading-relaxed text-[var(--fo-muted)]">
                        {aplicarVocabulario(s.description, v)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {/*
        Al pie y en tono menor a propósito: es una posibilidad, no una tarea pendiente. La
        creación del negocio es siempre explícita: nunca ocurre por visitar una ruta.
      */}
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--fo-border)] pt-4 text-xs text-[var(--fo-muted)]">
        {puedeCambiarPerfil ? (
          <form action={switchProfileAction}>
            <button type="submit" className="underline underline-offset-2 hover:text-[var(--fo-text)]">
              Cambiar de perfil
            </button>
          </form>
        ) : null}
        {!tieneNegocio ? (
          <form action={createOwnBusinessAction} className="leading-relaxed">
            {`¿Tenés tu propio estudio o querés enseñar? Creá tu espacio en FotoOffice para administrar tu negocio o subir tus cursos y que las instituciones los vendan, aparte de tu ficha de ${v.singular}.`}{" "}
            <button type="submit" className="underline underline-offset-2 hover:text-[var(--fo-text)]">
              Crear mi negocio
            </button>
          </form>
        ) : null}
      </footer>
    </div>
  );
}

const TONOS = {
  success: "text-[var(--fo-success)]",
  warning: "text-[var(--fo-warning)]",
  danger: "text-[var(--fo-danger)]",
  neutral: "text-[var(--fo-text)]",
} as const;

/** Un dato de un vistazo: rótulo chico, valor grande, una línea de contexto. */
function Indicador({
  rotulo,
  valor,
  detalle,
  tono = "neutral",
}: {
  rotulo: string;
  valor: string;
  detalle?: string | null;
  tono?: keyof typeof TONOS;
}) {
  return (
    <div className="fo-card min-w-0 p-3 sm:p-4">
      <p className="text-xs font-medium text-[var(--fo-muted)]">{rotulo}</p>
      <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${TONOS[tono]}`}>{valor}</p>
      {detalle ? <p className="text-xs leading-snug text-[var(--fo-muted)]">{detalle}</p> : null}
    </div>
  );
}

/**
 * El sorteo del mes en el inicio. Quien está al día lo ve destacado: es el premio por estarlo.
 * Quien no, ve qué le falta para entrar, con el camino a sus cuotas.
 */
function TarjetaSorteo({ sorteo }: { sorteo: PortalRaffleView }) {
  const { participating, reason, frozen } = sorteo.myStatus;
  return (
    <section
      className={`fo-card space-y-4 p-5 ${
        participating ? "border-2 border-[var(--fo-success-border)]" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted)]">
            Sorteo del mes
          </p>
          <h2 className="text-base font-semibold">{sorteo.title}</h2>
          <p className="text-sm text-[var(--fo-muted)]">Se sortea el {fechaHora(sorteo.drawsAt)}.</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            participating
              ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]"
              : "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]"
          }`}
        >
          {participating ? "Estás participando" : "Todavía no participás"}
        </span>
      </div>

      {!participating ? (
        <p className="text-sm">
          {reason}{" "}
          {!frozen ? (
            <>
              Si te ponés al día antes del {fechaHora(sorteo.entriesCloseAt)}, entrás.{" "}
              <Link href="/portal/cuotas" className="font-medium underline">
                Ver mis cuotas
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {sorteo.prizes.length > 0 ? <PrizeCards prizes={sorteo.prizes} compacta /> : null}

      <Link href="/portal/sorteos" className="inline-flex text-sm font-medium text-[var(--fo-accent-hover)] hover:underline">
        Ver el sorteo completo →
      </Link>
    </section>
  );
}
