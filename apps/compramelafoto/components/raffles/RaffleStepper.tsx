import { Check } from "lucide-react";
import type { RaffleStatus } from "@/lib/raffles/constants";
import { cn } from "@/lib/utils";

const PASOS: { key: RaffleStatus; label: string }[] = [
  { key: "BORRADOR", label: "Borrador" },
  { key: "ANUNCIADO", label: "Anunciado" },
  { key: "PADRON_SELLADO", label: "Lista cerrada" },
  { key: "SORTEADO", label: "Sorteado" },
  { key: "CERRADO", label: "Entregado" },
];

/** Los pasos del sorteo con el actual marcado y la fecha de cada uno debajo. */
export default function RaffleStepper({ status, dates }: { status: RaffleStatus; dates?: Partial<Record<RaffleStatus, string>> }) {
  const actual = PASOS.findIndex((p) => p.key === status);
  return (
    <ol className="flex w-full items-start">
      {PASOS.map((p, i) => {
        const hecho = actual > i;
        const ahora = actual === i;
        return (
          <li key={p.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn("absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2", actual >= i ? "bg-[#c27b3d]" : "bg-[#e5e7eb]")}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white",
                hecho && "bg-[#c27b3d] text-white",
                ahora && "bg-white text-[#c27b3d] ring-[#c27b3d]/20 outline outline-2 outline-[#c27b3d]",
                !hecho && !ahora && "bg-[#f3f4f6] text-[#9ca3af]",
              )}
            >
              {hecho ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("mt-2 text-xs font-semibold", ahora ? "text-[#111827]" : hecho ? "text-[#374151]" : "text-[#9ca3af]")}>
              {p.label}
            </span>
            {dates?.[p.key] && <span className="mt-0.5 hidden text-[11px] text-[#6b7280] sm:block">{dates[p.key]}</span>}
          </li>
        );
      })}
    </ol>
  );
}
