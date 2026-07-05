"use client";

import Link from "next/link";
import type { PreventaPackJourneyStep } from "@/lib/preventa-canjeable/preventa-pack-journey";

function stepCircle(status: PreventaPackJourneyStep["status"]): string {
  if (status === "done") return "bg-emerald-600 text-white border-emerald-600";
  if (status === "current") return "bg-[#c27b3d] text-white border-[#c27b3d]";
  return "bg-white text-gray-400 border-gray-200";
}

export default function PreventaPackHubJourney({ steps }: { steps: PreventaPackJourneyStep[] }) {
  if (steps.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-[#e8dcc8] bg-gradient-to-br from-[#fdf8f3] to-white p-5 sm:p-6 space-y-4"
      aria-label="Progreso de tu preventa"
    >
      <div>
        <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Tu preventa</h2>
        <p className="text-sm text-gray-600 mt-1 mb-0">
          Seguí estos pasos desde un solo lugar. Podés volver acá cuando quieras.
        </p>
      </div>
      <ol className="space-y-3 m-0 p-0 list-none">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3 items-start">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${stepCircle(step.status)}`}
              aria-hidden
            >
              {step.status === "done" ? "✓" : index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={`text-sm font-medium m-0 ${
                  step.status === "current" ? "text-[#1a1a1a]" : "text-gray-700"
                }`}
              >
                {step.label}
              </p>
              {step.description ? (
                <p className="text-xs text-gray-500 mt-0.5 mb-0">{step.description}</p>
              ) : null}
              {step.href && step.status === "current" ? (
                <Link
                  href={step.href}
                  className="inline-flex mt-2 text-sm font-semibold text-[#c27b3d] hover:underline"
                >
                  {step.id === "selfie" ? "Subir selfie →" : "Continuar →"}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
