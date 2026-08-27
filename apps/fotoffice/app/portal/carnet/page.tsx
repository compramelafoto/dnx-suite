import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { loadMyCard } from "@/lib/carnet/my-card";
import { MemberPhotoUpload } from "@/components/portal/member-photo-upload";
import { getActiveFeeValue } from "@/lib/membership/settings";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { RequestPrintedCard } from "./request-printed";
import { stateLabel } from "@/lib/carnet/fulfillment";
import { formatMinorArs } from "@/lib/membership/money";

export const dynamic = "force-dynamic";

function fechaLegible(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

/**
 * El carnet digital del socio — **nivel 2**.
 *
 * Acá sí se le dice por qué no está habilitado y cuánto debe: es su propia situación, y
 * ocultársela le impediría resolverla. El nivel público, el del QR, no muestra nada de eso.
 */
export default async function MiCarnetPage() {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");

  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  const carnet = await loadMyCard(context.member.id, base);

  // La foto se puede cargar aunque todavía no haya carnet: es lo que se le prometió al
  // asociarse — "podés ir teniéndola lista".
  const ficha = await prisma.member.findUnique({
    where: { id: context.member.id },
    select: { avatarUrl: true },
  });

  if (!carnet) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-12">
        <div className="fo-card space-y-3 p-6 text-center">
          <p className="text-base font-semibold">Todavía no tenés carnet</p>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            {context.workspace.name} todavía no emitió tu carnet digital. Cuando lo haga, lo vas
            a ver acá.
          </p>
          <Link href="/portal" className="text-xs text-[var(--fo-muted)] hover:underline">
            ← Volver
          </Link>
        </div>

        <div className="mt-6">
          <MemberPhotoUpload currentUrl={ficha?.avatarUrl ?? null} />
        </div>
      </main>
    );
  }

  // El precio de la tarjeta es el valor de una cuota. Se resuelve acá para poder mostrarlo
  // en el botón: pedirle a alguien que confirme un gasto sin decirle cuánto es no está bien.
  const socio = await prisma.member.findUnique({
    where: { id: context.member.id },
    select: { categoryId: true },
  });
  const valor = await getActiveFeeValue(context.workspace.id, socio?.categoryId ?? null, new Date());
  const precioMinor = valor ? decimalArsToMinor(valor.amountArs) : 0;

  const qr = carnet.verificationUrl
    ? await QRCode.toDataURL(carnet.verificationUrl, { margin: 1, width: 512 })
    : null;

  return (
    <main className="mx-auto max-w-sm space-y-5 px-5 py-10">
      <Link href="/portal" className="text-xs text-[var(--fo-muted)] hover:underline">
        ← Volver
      </Link>

      <div className="fo-card overflow-hidden p-0">
        <div
          className={`px-6 py-4 text-center ${
            carnet.enabled ? "bg-[var(--fo-success)]" : "bg-[var(--fo-danger)]"
          }`}
        >
          <p className="text-base font-semibold text-white">
            {carnet.enabled ? "Habilitado" : "No habilitado"}
          </p>
          <p className="mt-0.5 text-xs text-white/85">{carnet.institutionName}</p>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            {carnet.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- la foto es una URL de R2
              <img src={carnet.photoUrl} alt="" className="size-20 rounded-lg object-cover" />
            ) : (
              <div className="size-20 rounded-lg bg-[var(--fo-border)]" aria-hidden />
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-base font-semibold">{carnet.fullName}</p>
              <p className="text-sm text-[var(--fo-muted)]">Socio N° {carnet.memberNumber}</p>
              {carnet.category ? (
                <p className="text-sm text-[var(--fo-muted)]">{carnet.category}</p>
              ) : null}
            </div>
          </div>

          {qr ? (
            <div className="space-y-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URI generado acá */}
              <img src={qr} alt="Código QR de tu carnet" className="mx-auto size-44" />
              <p className="text-[11px] text-[var(--fo-muted-soft)]">
                Mostrá este código para que verifiquen tu condición de socio.
              </p>
            </div>
          ) : null}

          <dl className="space-y-1.5 border-t border-[var(--fo-border)] pt-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--fo-muted-soft)]">Carnet</dt>
              <dd className="font-medium tabular-nums">{carnet.cardNumber}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--fo-muted-soft)]">Vigente hasta</dt>
              <dd className="font-medium tabular-nums">{fechaLegible(carnet.validUntil)}</dd>
            </div>
            {carnet.printedState ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--fo-muted-soft)]">Tarjeta impresa</dt>
                <dd className="font-medium">{stateLabel(carnet.printedState)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {carnet.printedState ? null : precioMinor > 0 ? (
        <section className="fo-card space-y-2 p-5">
          <h2 className="text-sm font-semibold">¿Querés la tarjeta impresa?</h2>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            El carnet digital lo tenés siempre. La tarjeta física es opcional y cuesta el valor
            de una cuota. Se agrega a tus cuotas y se paga junto con ellas.
          </p>
          <RequestPrintedCard priceLabel={formatMinorArs(precioMinor)} />
        </section>
      ) : null}

      {!carnet.enabled && carnet.disabledReason ? (
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--fo-danger)]">Por qué no estás habilitado</h2>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{carnet.disabledReason}</p>
          {carnet.totalDueMinor > 0 ? (
            <Link href="/portal/cuotas" className="fo-btn fo-btn-primary inline-flex text-sm">
              Regularizar · {formatMinorArs(carnet.totalDueMinor)}
            </Link>
          ) : null}
        </section>
      ) : null}

      <MemberPhotoUpload currentUrl={ficha?.avatarUrl ?? null} />
    </main>
  );
}
