"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshRegistrationPaymentStatusAction } from "@/lib/checkout/actions/checkout";

const MAX_ATTEMPTS = 12;
const INTERVAL_MS = 2500;

/**
 * Tras retorno MP: reintenta refresh S2S hasta CONFIRMED o agotar intentos.
 * No confirma por query params del navegador.
 */
export function PaymentReturnPoller(props: {
  registrationId: string;
  accessToken: string;
  editionSlug: string;
  initiallyConfirmed: boolean;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("Verificando tu pago…");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (props.initiallyConfirmed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async (n: number) => {
      if (cancelled) return;
      setAttempt(n);
      setMessage(
        n <= 1
          ? "Verificando tu pago…"
          : `Verificando tu pago… (intento ${n}/${MAX_ATTEMPTS})`,
      );
      const res = await refreshRegistrationPaymentStatusAction(
        props.registrationId,
        props.accessToken,
        props.editionSlug,
      );
      if (cancelled) return;
      if (res.ok && res.data?.confirmed) {
        setMessage("¡Tu inscripción está confirmada!");
        startTransition(() => router.refresh());
        return;
      }
      if (n >= MAX_ATTEMPTS) {
        setMessage(
          "Todavía estamos verificando el pago. No realices un segundo pago. Recargá en unos segundos o consultá Mi cuenta.",
        );
        return;
      }
      timer = setTimeout(() => void tick(n + 1), INTERVAL_MS);
    };

    timer = setTimeout(() => void tick(1), 400);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    props.initiallyConfirmed,
    props.registrationId,
    props.accessToken,
    props.editionSlug,
    router,
  ]);

  if (props.initiallyConfirmed) return null;

  return (
    <p className="max-w-2xl text-sm text-ck-text-secondary" role="status" aria-live="polite">
      {message}
      {attempt > 0 && attempt < MAX_ATTEMPTS ? (
        <span className="sr-only"> Intento {attempt} de {MAX_ATTEMPTS}.</span>
      ) : null}
    </p>
  );
}
