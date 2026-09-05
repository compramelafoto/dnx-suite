"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MpSplit1nHomologationBrick,
  type MpSplit1nBrickResult,
} from "@/components/homologation/MpSplit1nHomologationBrick";
import type { HomologationScenarioId } from "@/lib/homologation/mp-split-1n/scenarios";

type ScenarioView = {
  id: HomologationScenarioId;
  label: string;
  partnerCount: number;
  amountMinor: number;
  currency: string;
};

type Step = "producto" | "pago" | "resultado";

const PAYER_EMAIL = "buyer.clf.homolog@testuser.com";

function precio(amountMinor: number, currency: string) {
  return `$${(amountMinor / 100).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

/** `processed` / `accredited` es lo que el video tiene que dejar ver. */
function esAprobado(result: MpSplit1nBrickResult | null): boolean {
  return result?.uiState === "APPROVED";
}

export function CompraClient(props: {
  publicKey: string;
  scenarios: ScenarioView[];
}) {
  const [step, setStep] = useState<Step>("producto");
  const [scenarioId, setScenarioId] = useState<HomologationScenarioId>(
    "OWNER_PLUS_2",
  );
  const [result, setResult] = useState<MpSplit1nBrickResult | null>(null);

  const selected = useMemo(
    () => props.scenarios.find((s) => s.id === scenarioId) ?? props.scenarios[0],
    [props.scenarios, scenarioId],
  );

  const onResult = useCallback((r: MpSplit1nBrickResult) => {
    setResult(r);
    setStep("resultado");
  }, []);

  const volverAlComercio = useCallback(() => {
    setResult(null);
    setStep("producto");
  }, []);

  if (!selected) return null;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <span className="text-lg font-semibold tracking-tight text-neutral-900">
          Comprame la Foto
        </span>
        <span className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-900">
          Sandbox
        </span>
      </header>

      <ol className="mb-8 flex items-center gap-2 text-xs text-neutral-500">
        {(["producto", "pago", "resultado"] as const).map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={
                step === s
                  ? "font-semibold text-neutral-900"
                  : "text-neutral-400"
              }
            >
              {i + 1}. {s === "producto" ? "Tu foto" : s === "pago" ? "Pago" : "Listo"}
            </span>
            {i < 2 ? <span className="text-neutral-300">→</span> : null}
          </li>
        ))}
      </ol>

      {step === "producto" ? (
        <section className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="flex aspect-[3/2] items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
              <span className="text-sm text-neutral-500">
                Vista previa de la foto
              </span>
            </div>
            <div className="space-y-3 p-5">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
                Foto digital en alta resolución
              </h1>
              <p className="text-sm leading-relaxed text-neutral-600">
                Descarga inmediata, sin marca de agua, para uso personal.
              </p>
              <p className="text-2xl font-semibold text-neutral-900">
                {precio(selected.amountMinor, selected.currency)}
              </p>
            </div>
          </div>

          {props.scenarios.length > 1 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Reparto de la venta
              </p>
              <div className="flex flex-wrap gap-2">
                {props.scenarios.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScenarioId(s.id)}
                    className={
                      s.id === scenarioId
                        ? "rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white"
                        : "rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700 hover:border-neutral-400"
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-500">
                {selected.partnerCount + 1} destinatarios · el importe se reparte
                al acreditarse.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setStep("pago")}
            className="w-full rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Comprar {precio(selected.amountMinor, selected.currency)}
          </button>
        </section>
      ) : null}

      {step === "pago" ? (
        <section className="space-y-6">
          <div className="flex items-baseline justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span className="text-sm text-neutral-700">
              Foto digital en alta resolución
            </span>
            <span className="text-sm font-semibold text-neutral-900">
              {precio(selected.amountMinor, selected.currency)}
            </span>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 text-base font-semibold tracking-tight text-neutral-900">
              Pagá con tarjeta
            </h2>
            <MpSplit1nHomologationBrick
              key={selected.id}
              publicKey={props.publicKey}
              scenarioId={selected.id}
              amountMinor={selected.amountMinor}
              currency={selected.currency}
              payerEmail={PAYER_EMAIL}
              onResult={onResult}
              showDebugMeta={false}
              showSandboxBanner={false}
            />
          </div>

          <button
            type="button"
            onClick={() => setStep("producto")}
            className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-700"
          >
            Volver
          </button>
        </section>
      ) : null}

      {step === "resultado" ? (
        <section className="space-y-6">
          <div
            className={
              esAprobado(result)
                ? "rounded-xl border border-emerald-200 bg-emerald-50 p-6"
                : "rounded-xl border border-red-200 bg-red-50 p-6"
            }
            role="status"
          >
            <p
              className={
                esAprobado(result)
                  ? "text-lg font-semibold text-emerald-900"
                  : "text-lg font-semibold text-red-900"
              }
            >
              {esAprobado(result) ? "Pago aprobado" : "El pago no se completó"}
            </p>
            <p
              className={
                esAprobado(result)
                  ? "mt-2 text-sm leading-relaxed text-emerald-800"
                  : "mt-2 text-sm leading-relaxed text-red-800"
              }
            >
              {result?.message ?? "Sin detalle del proveedor."}
            </p>
          </div>

          <dl className="space-y-2 rounded-lg border border-neutral-200 bg-white p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Producto</dt>
              <dd className="text-neutral-900">Foto digital en alta resolución</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-500">Importe</dt>
              <dd className="text-neutral-900">
                {precio(selected.amountMinor, selected.currency)}
              </dd>
            </div>
            {result?.status ? (
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Estado de la orden</dt>
                <dd className="font-mono text-xs text-neutral-900">
                  {result.status}
                  {result.statusDetail ? ` · ${result.statusDetail}` : ""}
                </dd>
              </div>
            ) : null}
            {result?.providerOrderIdPrefix ? (
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Orden</dt>
                <dd className="font-mono text-xs text-neutral-900">
                  {result.providerOrderIdPrefix}…
                </dd>
              </div>
            ) : null}
          </dl>

          <button
            type="button"
            onClick={volverAlComercio}
            className="w-full rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Volver a Comprame la Foto
          </button>
        </section>
      ) : null}
    </main>
  );
}
