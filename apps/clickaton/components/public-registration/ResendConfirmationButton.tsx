"use client";

import { useState, useTransition } from "react";
import { resendConfirmationEmailAction } from "@/lib/registration/notifications/resend-confirmation-action";

type Props = {
  registrationId: string;
  accessToken: string;
  editionSlug: string;
};

export function ResendConfirmationButton(props: Props) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await resendConfirmationEmailAction(props);
            setOk(result.ok);
            setFeedback(result.message);
          });
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-[var(--ck-radius-control)] border-2 border-[#F9B114] bg-transparent px-5 text-sm font-semibold text-[#F9B114] transition hover:bg-[#F9B114] hover:text-[#111] disabled:opacity-50"
      >
        {pending ? "Reenviando…" : "REENVIAR EMAIL"}
      </button>
      {feedback ? (
        <p
          className={`text-sm ${ok ? "text-emerald-400" : "text-ck-text-secondary"}`}
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
