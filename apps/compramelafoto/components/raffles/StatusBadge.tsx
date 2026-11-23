import { STATUS_LABELS, type RaffleStatus } from "@/lib/raffles/constants";
import { cn } from "@/lib/utils";

const COLORES: Record<RaffleStatus, string> = {
  BORRADOR: "bg-[#f3f4f6] text-[#374151] ring-[#d1d5db]",
  ANUNCIADO: "bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]",
  PADRON_SELLADO: "bg-[#fffbeb] text-[#92400e] ring-[#fde68a]",
  SORTEADO: "bg-[#ecfdf5] text-[#047857] ring-[#a7f3d0]",
  CERRADO: "bg-[#f8fafc] text-[#475569] ring-[#cbd5e1]",
  CANCELADO: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]",
};

const PUNTO: Record<RaffleStatus, string> = {
  BORRADOR: "bg-[#9ca3af]",
  ANUNCIADO: "bg-[#3b82f6] animate-pulse",
  PADRON_SELLADO: "bg-[#f59e0b]",
  SORTEADO: "bg-[#10b981]",
  CERRADO: "bg-[#64748b]",
  CANCELADO: "bg-[#ef4444]",
};

export default function StatusBadge({ status, className }: { status: RaffleStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        COLORES[status] ?? COLORES.BORRADOR,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", PUNTO[status] ?? PUNTO.BORRADOR)} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
