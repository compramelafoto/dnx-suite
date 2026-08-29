import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { assertClfMpSplit1nHomologationSafe } from "@/lib/homologation/mp-split-1n/assert-safe-environment";
import { listHomologationScenarios } from "@/lib/homologation/mp-split-1n/scenarios";
import { HomologationClient } from "./HomologationClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MP Split 1:N Homologation (sandbox)",
  robots: { index: false, follow: false, nocache: true },
};

export default function ClfMpSplit1nHomologationPage() {
  const safety = assertClfMpSplit1nHomologationSafe();
  if (!safety.ok) {
    redirect("/admin?homologacion=blocked");
  }

  const publicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ||
    process.env.MERCADOPAGO_TEST_PUBLIC_KEY?.trim() ||
    "";

  const scenarios = listHomologationScenarios().map((s) => ({
    id: s.id,
    label: s.label,
    partnerCount: s.partnerCount,
    amountMinor: Number(s.totalMinor),
    currency: s.currency,
  }));

  return (
    <div className="mx-auto box-border w-full min-w-0 max-w-4xl space-y-8 p-6 md:p-8">
      <header className="w-full space-y-4 border-b border-neutral-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 whitespace-normal">
          Mercado Pago Split 1:N — Homologation Test
        </p>
        <h1 className="text-2xl font-semibold text-neutral-900 whitespace-normal">
          Card Payment Brick · DNX Payments · Sandbox
        </h1>
        <p className="max-w-none text-sm leading-relaxed text-neutral-600 whitespace-normal">
          Superficie aislada. No modifica Checkout Pro / marketplace_fee. No
          crea ventas, descargas ni emails comerciales.
        </p>
        <dl className="grid w-full grid-cols-2 gap-4 text-xs text-neutral-700 sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="font-semibold">Environment</dt>
            <dd>SANDBOX</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold">Production</dt>
            <dd>BLOCKED</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold">Source</dt>
            <dd className="break-all">CLF_CARD_BRICK_HOMOLOGATION</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-semibold">App</dt>
            <dd>CLF monorepo (test only)</dd>
          </div>
        </dl>
      </header>

      {!publicKey ? (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          Falta{" "}
          <code>NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY</code> o{" "}
          <code>MERCADOPAGO_TEST_PUBLIC_KEY</code> en el env de CLF.
        </div>
      ) : (
        <HomologationClient publicKey={publicKey} scenarios={scenarios} />
      )}
    </div>
  );
}
