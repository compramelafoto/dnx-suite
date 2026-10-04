import { formatMinorArs } from "@/lib/membership/money";

/** Un importe en pesos, como lo lee una persona ("$ 15.000,00"). `from` antepone "Desde". */
export function Price({ minor, from = false, className }: { minor: number; from?: boolean; className?: string }) {
  return (
    <span className={className}>
      {from ? <span className="font-normal text-[var(--fo-muted)]">Desde </span> : null}
      <span className="tabular-nums">{formatMinorArs(minor)}</span>
    </span>
  );
}
