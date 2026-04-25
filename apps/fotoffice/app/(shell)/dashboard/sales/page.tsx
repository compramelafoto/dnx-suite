import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function DashboardSalesPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Ventas"
        description="Configurá los productos de venta de tu workspace."
      />
      <div className="grid gap-6 md:grid-cols-2">
        <article className="fo-card space-y-3">
          <h2 className="text-lg font-semibold">Cursos presenciales</h2>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            MVP funcional: cursos, ediciones con cupos, inscripción y cobro por Mercado Pago.
          </p>
          <Link href="/dashboard/courses" className="fo-btn fo-btn-primary text-sm w-fit">
            Ir a cursos
          </Link>
        </article>
        <article className="fo-card space-y-3">
          <h2 className="text-lg font-semibold">Productos</h2>
          <p className="text-sm text-[var(--fo-muted)]">Próximamente.</p>
        </article>
        <article className="fo-card space-y-3">
          <h2 className="text-lg font-semibold">Cursos online / grabados</h2>
          <p className="text-sm text-[var(--fo-muted)]">Próximamente.</p>
        </article>
      </div>
    </div>
  );
}
