import Link from "next/link";

/** Las pestañas de Cotizaciones: todas, o las que armó el bot y esperan aprobación. */
export function PestanasCotizaciones({ activa, porAprobar }: { activa: "todas" | "por-aprobar"; porAprobar: number }) {
  const clase = (on: boolean) =>
    `border-b-2 px-3 py-2 text-sm ${on ? "border-[var(--fo-accent)] font-medium text-[var(--fo-text)]" : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]"}`;
  return (
    <nav aria-label="Cotizaciones" className="flex flex-wrap gap-1 border-b border-[var(--fo-border)]">
      <Link href="/presupuestos" className={clase(activa === "todas")} aria-current={activa === "todas" ? "page" : undefined}>
        Todas
      </Link>
      <Link href="/presupuestos/por-aprobar" className={clase(activa === "por-aprobar")} aria-current={activa === "por-aprobar" ? "page" : undefined}>
        Por aprobar{porAprobar > 0 ? ` (${porAprobar})` : ""}
      </Link>
    </nav>
  );
}
