"use client";

import { useState } from "react";

export function CourseEnrollmentPaymentButton({
  enrollmentId,
  workspaceSlug,
  courseSlug,
  label,
}: {
  enrollmentId: string;
  workspaceSlug: string;
  courseSlug: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/mercadopago/course-enrollment/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          workspaceSlug,
          courseSlug,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        initPoint?: string | null;
        sandboxInitPoint?: string | null;
      };
      if (!response.ok) {
        throw new Error(json.error || "No se pudo iniciar el checkout.");
      }
      const redirectUrl = json.initPoint || json.sandboxInitPoint;
      if (!redirectUrl) {
        throw new Error("Mercado Pago no devolvió URL de checkout.");
      }
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el pago.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="fo-btn fo-btn-primary"
      >
        {pending ? "Redirigiendo al checkout..." : (label ?? "Continuar al pago")}
      </button>
      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
