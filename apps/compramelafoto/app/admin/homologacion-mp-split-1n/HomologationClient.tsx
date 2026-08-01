"use client";

import { useMemo, useState } from "react";
import { MpSplit1nHomologationBrick } from "@/components/homologation/MpSplit1nHomologationBrick";
import type { HomologationScenarioId } from "@/lib/homologation/mp-split-1n/scenarios";

type ScenarioView = {
  id: HomologationScenarioId;
  label: string;
  partnerCount: number;
  amountMinor: number;
  currency: string;
};

export function HomologationClient(props: {
  publicKey: string;
  scenarios: ScenarioView[];
}) {
  const [scenarioId, setScenarioId] = useState<HomologationScenarioId>(
    "OWNER_PLUS_2",
  );
  const selected = useMemo(
    () => props.scenarios.find((s) => s.id === scenarioId) ?? props.scenarios[0],
    [props.scenarios, scenarioId],
  );

  if (!selected) return null;

  return (
    <div className="w-full min-w-0 space-y-8">
      <section className="w-full space-y-4 rounded border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Scenario</h2>
        <div className="flex flex-wrap gap-2">
          {props.scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScenarioId(s.id)}
              className={
                s.id === scenarioId
                  ? "rounded bg-neutral-900 px-3 py-2 text-sm text-white"
                  : "rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-800"
              }
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-600">
          Amount (server-side): ${(selected.amountMinor / 100).toFixed(2)}{" "}
          {selected.currency} · partners={selected.partnerCount}
        </p>
      </section>

      <section className="w-full min-w-0 rounded border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">
          Card Payment Brick
        </h2>
        <MpSplit1nHomologationBrick
          key={selected.id}
          publicKey={props.publicKey}
          scenarioId={selected.id}
          amountMinor={selected.amountMinor}
          currency={selected.currency}
          payerEmail="buyer.clf.homolog@testuser.com"
        />
      </section>

      <section className="rounded border border-dashed border-neutral-300 p-4 text-xs text-neutral-600">
        <p className="font-semibold text-neutral-800">Tarjeta TEST</p>
        <p className="mt-2 whitespace-normal leading-relaxed">
          Usá una tarjeta oficial de prueba de Mercado Pago. Para{" "}
          <strong>aprobar</strong>, el nombre del titular debe ser{" "}
          <code>APRO</code> (sandbox). No pegues PAN/CVV en tickets ni en git.
        </p>
        <p className="mt-4 font-semibold text-neutral-800">Después del pago</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>No copies tarjeta / token / device ID.</li>
          <li>
            En Cursor escribí: <code>PAGO BRICK CLF EJECUTADO</code>
          </li>
          <li>
            Verificación:{" "}
            <code>pnpm --filter @repo/payments smoke:clf-brick-verify</code>
          </li>
        </ol>
      </section>
    </div>
  );
}
