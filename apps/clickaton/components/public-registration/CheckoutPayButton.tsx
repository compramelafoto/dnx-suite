"use client";

import { useFormStatus } from "react-dom";
import { startRegistrationCheckoutAction } from "@/lib/checkout/actions/checkout";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";

type Props = {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  amountMinor: number;
  currency: string;
  expiresLabel: string;
  eligible: boolean;
};

function SubmitButton({ eligible }: { eligible: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!eligible || pending}
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-ck-yellow px-6 text-sm font-semibold text-ck-bg disabled:cursor-not-allowed disabled:opacity-50"
      aria-busy={pending}
    >
      {pending ? "Preparando pago…" : "Continuar al pago"}
    </button>
  );
}

/** Client Component: solo UI + form action (sin Prisma ni SDK de proveedor). */
export function CheckoutPayButton(props: Props) {
  if (!props.eligible) return null;

  return (
    <form action={startRegistrationCheckoutAction} className="space-y-3">
      <input type="hidden" name="registrationId" value={props.registrationId} />
      <input type="hidden" name="editionSlug" value={props.editionSlug} />
      <input type="hidden" name="accessToken" value={props.accessToken} />
      <p className="text-sm text-ck-text-secondary">
        Importe a pagar:{" "}
        <strong className="text-ck-text">{formatPublicPrice(props.amountMinor, props.currency)}</strong>
        {" · "}
        Reserva hasta {props.expiresLabel}
        {" · "}
        Proveedor de pago gestionado por DNX Payments
      </p>
      <SubmitButton eligible={props.eligible} />
    </form>
  );
}
