"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createGiftRegistrationAction } from "@/lib/gift-vouchers/actions/gift-vouchers";
import { previewPublicPromotionAction } from "@/lib/public-registration/actions/preview-promotion";
import { RegistrationPromoCodeField } from "@/components/public-registration/experience/RegistrationPromoCodeField";
import type { PublicRegistrationContextDto } from "@/lib/public-registration/domain/types";

const GIFT_MESSAGE_MAX = 500;

type AppliedPromo = {
  code: string;
  name: string;
  discountAmount: number;
  finalAmount: number;
};

function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function GiftPurchaseForm(props: {
  context: PublicRegistrationContextDto;
  editionSlug: string;
  idempotencyKey: string;
}) {
  const router = useRouter();
  // El Pack de 4 maratones no se regala: le da créditos a quien lo compra.
  const sellableTickets = useMemo(
    () =>
      props.context.tickets.filter(
        (t) => !t.isSoldOut && t.salesStatus === "open" && !t.isMarathonPack,
      ),
    [props.context.tickets],
  );

  const [ticketTypeId, setTicketTypeId] = useState(sellableTickets[0]?.id ?? "");
  const [giftMessage, setGiftMessage] = useState("");
  const [email, setEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);
  const [state, formAction, pending] = useActionState(createGiftRegistrationAction, undefined);

  // La redirección va en un efecto: hacerla durante el render deja a React
  // actualizando el Router mientras dibuja este componente.
  useEffect(() => {
    if (state?.ok && state.data) {
      router.push(
        `/maratones/${props.editionSlug}/regalar/listo?code=${encodeURIComponent(state.data.voucherCode)}`,
      );
    }
  }, [state, router, props.editionSlug]);

  const currentPhase = props.context.currentPricePhase;
  const selected = sellableTickets.find((t) => t.id === ticketTypeId);
  const fullPrice =
    currentPhase && selected && selected.priceAmount > 0
      ? currentPhase.amount
      : (selected?.priceAmount ?? 0);
  // Lo que se va a cobrar. El backend lo vuelve a calcular: esto es lo que
  // se muestra, y tiene que coincidir con lo que termina pagando.
  const price = promoApplied ? promoApplied.finalAmount : fullPrice;

  // Los campos no controlados se repueblan solos con defaultValue cuando el
  // alta falla; el email es controlado, así que hay que devolvérselo a mano.
  useEffect(() => {
    if (state && !state.ok && state.values?.email) setEmail(state.values.email);
  }, [state]);

  // Cambiar de entrada cambia el monto, así que el cupón validado contra el
  // monto anterior deja de valer: se limpia en vez de mentir un descuento.
  useEffect(() => {
    setPromoApplied(null);
    setPromoError(null);
  }, [ticketTypeId]);

  async function aplicarCupon() {
    const code = promoCode.trim();
    if (!code || !ticketTypeId) return;
    setPromoPending(true);
    setPromoError(null);
    try {
      const res = await previewPublicPromotionAction({
        editionSlug: props.editionSlug,
        ticketTypeId,
        promoCode: code,
        email: email.trim() || undefined,
      });
      if (!res.ok) {
        setPromoApplied(null);
        setPromoError(res.message);
        return;
      }
      setPromoApplied({
        code: res.quote.code,
        name: res.quote.name,
        discountAmount: res.quote.discountAmount,
        finalAmount: res.quote.finalAmount,
      });
    } catch {
      setPromoError("No pudimos validar el código. Probá de nuevo.");
    } finally {
      setPromoPending(false);
    }
  }

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="editionSlug" value={props.editionSlug} />
      <input type="hidden" name="idempotencyKey" value={props.idempotencyKey} />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold md:text-2xl">Qué le regalás</h2>
        <div className="space-y-3">
          {sellableTickets.map((ticket) => (
            <label
              key={ticket.id}
              className={`flex cursor-pointer items-start gap-3 rounded-[var(--ck-radius-control)] border p-4 ${
                ticketTypeId === ticket.id ? "border-ck-yellow" : "border-ck-border"
              }`}
            >
              <input
                type="radio"
                name="ticketTypeId"
                value={ticket.id}
                checked={ticketTypeId === ticket.id}
                onChange={() => setTicketTypeId(ticket.id)}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="block font-semibold">{ticket.name}</span>
                {ticket.description ? (
                  <span className="block text-sm text-ck-text-secondary">
                    {ticket.description}
                  </span>
                ) : null}
              </span>
              <span className="font-semibold">
                {formatAmount(
                  currentPhase && ticket.priceAmount > 0
                    ? currentPhase.amount
                    : ticket.priceAmount,
                  ticket.currency,
                )}
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-ck-text-secondary">
          La sede y el talle los elige tu amigo cuando activa el regalo. Vos no
          tenés que adivinar nada.
        </p>
      </section>

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold md:text-2xl">Tus datos</legend>
        <p className="text-sm text-ck-text-secondary">
          Te mandamos el voucher a este correo para que se lo pases a tu amigo.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="firstName" label="Tu nombre *" defaultValue={state?.values?.firstName} />
          <Field id="lastName" label="Tu apellido *" defaultValue={state?.values?.lastName} />
          <Field
            id="email"
            label="Tu email *"
            type="email"
            value={email}
            onChange={setEmail}
          />
          <Field id="phone" label="Tu teléfono" defaultValue={state?.values?.phone} />
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold md:text-2xl">Para quién es</legend>
        <p className="text-sm text-ck-text-secondary">
          Podés dejarlo en blanco y mandarle el link vos por WhatsApp.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="recipientName"
            label="Nombre de tu amigo"
            defaultValue={state?.values?.recipientName}
          />
          <Field
            id="recipientEmail"
            label="Email de tu amigo"
            type="email"
            defaultValue={state?.values?.recipientEmail}
          />
        </div>
        <div>
          <label htmlFor="giftMessage" className="ck-label text-ck-text">
            Dedicatoria
          </label>
          <textarea
            id="giftMessage"
            name="giftMessage"
            rows={3}
            maxLength={GIFT_MESSAGE_MAX}
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
          />
          <p className="mt-1 text-xs text-ck-text-secondary">
            {giftMessage.length} / {GIFT_MESSAGE_MAX}
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="text-xl font-semibold md:text-2xl">Código de descuento</legend>
        <p className="text-sm text-ck-text-secondary">
          Si ya participaste de una Clickatón, tu código también sirve para
          regalar.
        </p>
        {/* Se manda el texto escrito aunque no hayan tocado "Aplicar": si el
            código sirve, el backend lo descuenta igual; si no sirve, frena la
            compra en vez de cobrar el precio entero por sorpresa. */}
        <input
          type="hidden"
          name="promoCode"
          value={promoApplied?.code ?? promoCode.trim()}
        />
        <RegistrationPromoCodeField
          value={promoCode}
          onChange={setPromoCode}
          onApply={aplicarCupon}
          onClear={() => {
            setPromoApplied(null);
            setPromoCode("");
            setPromoError(null);
          }}
          pending={promoPending}
          error={promoError}
          applied={
            promoApplied
              ? {
                  code: promoApplied.code,
                  name: promoApplied.name,
                  discountLabel: `−${formatAmount(promoApplied.discountAmount, props.context.edition.currency ?? "ARS")}`,
                }
              : null
          }
          disabled={pending || !ticketTypeId}
        />
        {promoApplied ? (
          <p className="text-sm text-ck-text-secondary">
            Antes {formatAmount(fullPrice, props.context.edition.currency ?? "ARS")} · ahora{" "}
            <strong className="text-ck-text">
              {formatAmount(price, props.context.edition.currency ?? "ARS")}
            </strong>
          </p>
        ) : null}
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="acceptTerms" className="mt-1" />
        <span>
          Acepto las bases y condiciones de la Clickatón en nombre de quien reciba
          este regalo, que también las va a aceptar al activarlo.
        </span>
      </label>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-[var(--ck-danger)]">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !ticketTypeId}>
        {pending
          ? "Preparando el pago…"
          : `Pagar el regalo — ${formatAmount(price, props.context.edition.currency ?? "ARS")}`}
      </Button>
    </form>
  );
}

function Field(props: {
  id: string;
  label: string;
  type?: string;
  defaultValue?: string;
  /** Controlado sólo donde otro pedazo de la pantalla necesita el valor. */
  value?: string;
  onChange?: (value: string) => void;
}) {
  const controlado = props.onChange !== undefined;
  return (
    <div>
      <label htmlFor={props.id} className="ck-label text-ck-text">
        {props.label}
      </label>
      <input
        id={props.id}
        name={props.id}
        type={props.type ?? "text"}
        {...(controlado
          ? {
              value: props.value ?? "",
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                props.onChange?.(e.target.value),
            }
          : { defaultValue: props.defaultValue ?? "" })}
        className="mt-2 w-full rounded-[var(--ck-radius-control)] border border-ck-border bg-ck-surface px-4 py-3"
      />
    </div>
  );
}
