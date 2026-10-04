import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadPublicBookingViewer } from "@/lib/bookings/public-member";
import { doorPathFor } from "@/lib/entrada/institution-door";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { prisma } from "@repo/db";
import { spacePriceLabel } from "@/lib/bookings/pricing";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { listSpaces } from "@/lib/bookings/repository";
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

  const [todos, vocabulary] = await Promise.all([
    listSpaces(branding.workspaceId),
    loadPersonVocabulary(branding.workspaceId),
  ]);
  const espacios = todos.filter((e) => e.allowsNonMembers);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-12 md:px-8 md:py-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Alquilar un espacio</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
          Estos son los espacios disponibles y sus tarifas.{" "}
          <strong>Si sos socio, entrá a tu portal</strong>: el precio es menor y tenés horas
          bonificadas por mes.
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
            Por ahora no hay espacios disponibles para alquilar.
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
                    {spacePriceLabel(espacio, "NON_MEMBER")}
                  </span>
                  <span className="text-xs text-[var(--fo-accent-hover)]">
                    {vocabulary.Plural}:{" "}
                    {spacePriceLabel(espacio, "MEMBER")}
                    {espacio.memberFreeHoursPerMonth > 0
                      ? ` + ${espacio.memberFreeHoursPerMonth} h gratis por mes`
                      : ""}
                  </span>
                  <Link
                    href={`/w/${workspaceSlug}/reservas/${espacio.id}`}
                    className="fo-btn fo-btn-primary text-sm"
                  >
                    Reservar
                  </Link>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-[var(--fo-muted-soft)]">
        El horario queda reservado cuando se acredita el pago por Mercado Pago. ¿Sos{" "}
        {vocabulary.singular}?{" "}
        <Link href={doorPathFor(workspaceSlug)} className="underline underline-offset-4">
          Ingresá
        </Link>{" "}
        y reservá con tu precio.
      </p>
    </main>
  );
}
