import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadPublicBookingViewer } from "@/lib/bookings/public-member";
import { doorPathFor } from "@/lib/entrada/institution-door";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { prisma } from "@repo/db";
import { spacePriceLabel, turnPriceLabel } from "@/lib/bookings/pricing";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { getBookingWording, listSpaces } from "@/lib/bookings/repository";
import { minuteOfDayToLabel } from "@/lib/bookings/time";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ error?: string }>;
};

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * Los espacios que la institución alquila a quien no es socio.
 *
 * Reservar no exige cuenta: el correo identifica la reserva (ver `[spaceId]/page.tsx`).
 */
export default async function PublicBookingsPage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const query = await searchParams;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) notFound();

  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, BOOKINGS_MODULE_KEY))) notFound();

  // El socio con sesión reserva desde su portal, con su precio.
  if ((await loadPublicBookingViewer(branding.workspaceId)).isMemberHere) redirect("/portal/reservas");

  const [todos, vocabulary, wording] = await Promise.all([
    listSpaces(branding.workspaceId),
    loadPersonVocabulary(branding.workspaceId),
    getBookingWording(branding.workspaceId),
  ]);
  const espacios = todos.filter((e) => e.allowsNonMembers);
  const turnos = wording.kind === "PROFESIONALES";
  // El beneficio del socio se menciona sólo si existe: con el mismo precio y sin horas gratis,
  // "si sos socio, pagás menos" era una promesa falsa.
  const conBeneficio = (e: (typeof espacios)[number]) =>
    e.memberFreeHoursPerMonth > 0 ||
    spacePriceLabel(e, "MEMBER") !== spacePriceLabel(e, "NON_MEMBER");
  const algunBeneficio = espacios.some(conBeneficio);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-12 md:px-8 md:py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{wording.pageTitle}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
          {turnos
            ? `Elegí a tu ${wording.singular}, el día y la hora.`
            : `Estos son los ${wording.plural} disponibles y sus tarifas.`}{" "}
          {algunBeneficio ? (
            <>
              <strong>Si sos {vocabulary.singular}, entrá a tu portal</strong>: tenés tu precio
              {espacios.some((e) => e.memberFreeHoursPerMonth > 0) ? " y horas bonificadas por mes" : ""}.
            </>
          ) : null}
        </p>
      </div>

      {query.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {query.error}
        </p>
      ) : null}

      {espacios.length === 0 ? (
        <div className="fo-card p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            {wording.emptyText}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {espacios.map((espacio) => (
            <section key={espacio.id} className="fo-card space-y-3 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-base font-semibold">{espacio.name}</h2>
                  {espacio.description ? (
                    <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
                      {espacio.description}
                    </p>
                  ) : null}
                  <p className="text-xs text-[var(--fo-muted-soft)]">
                    {espacio.weeklyHours
                      .map(
                        (h) =>
                          `${DIAS[h.weekday]} ${minuteOfDayToLabel(h.startMinute)}–${minuteOfDayToLabel(h.endMinute)}`,
                      )
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                  <span className="text-sm font-medium">
                    {turnos
                      ? turnPriceLabel(espacio, "NON_MEMBER")
                      : spacePriceLabel(espacio, "NON_MEMBER")}
                  </span>
                  {conBeneficio(espacio) ? (
                    <span className="text-xs text-[var(--fo-accent-hover)]">
                      {vocabulary.Plural}:{" "}
                      {spacePriceLabel(espacio, "MEMBER")}
                      {espacio.memberFreeHoursPerMonth > 0
                        ? ` + ${espacio.memberFreeHoursPerMonth} h gratis por mes`
                        : ""}
                    </span>
                  ) : null}
                  <Link
                    href={`/w/${workspaceSlug}/reservas/${espacio.id}`}
                    className="fo-btn fo-btn-primary text-sm"
                  >
                    {wording.bookLabel}
                  </Link>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-[var(--fo-muted-soft)]">
        {turnos ? "El turno" : "El horario"} queda reservado cuando se acredita el pago por Mercado Pago. ¿Sos{" "}
        {vocabulary.singular}?{" "}
        <Link href={doorPathFor(workspaceSlug)} className="underline underline-offset-4">
          Ingresá
        </Link>{" "}
        y reservá desde tu portal.
      </p>
    </main>
  );
}
