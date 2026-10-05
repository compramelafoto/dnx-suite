// app/(shell)/dashboard/cobros-de-cursos/page.tsx
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireDuenoOAdminDelNegocio } from "@/lib/course-marketplace/access";
import { ESTADO_DE_PAGO, ROTULO_DE_PARTE, resumirCobros, type FilaCobro } from "@/lib/course-marketplace/cobros";
import { pesos } from "@/lib/course-marketplace/formato";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";

export const dynamic = "force-dynamic";

/**
 * No exige el módulo de cursos: un docente o una productora pueden cobrar su parte sin vender
 * cursos ellos mismos. Sí exige ser dueño o admin: es plata.
 */
export default async function CobrosDeCursosPage() {
  const { workspace } = await requireDuenoOAdminDelNegocio();
  const partes = await prisma.courseSaleShare.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      kind: true,
      amountArs: true,
      createdAt: true,
      enrollment: {
        select: { id: true, workspaceId: true, paymentStatus: true, amountArs: true, course: { select: { title: true } } },
      },
    },
  });
  const filas: FilaCobro[] = partes.map((p) => ({
    id: p.id,
    enrollmentId: p.enrollment.id,
    kind: p.kind,
    montoCentavos: Math.round(Number(p.amountArs) * 100),
    pagaElAlumnoCentavos: Math.round(Number(p.enrollment.amountArs) * 100),
    curso: p.enrollment.course.title,
    fecha: p.createdAt,
    estadoPago: p.enrollment.paymentStatus,
    vendioEsteNegocio: p.enrollment.workspaceId === workspace.id,
  }));
  const r = resumirCobros(filas);

  return (
    <div className="space-y-8">
      <PageHeader title="Cobros" description="Lo que vendiste y lo que te tocó de cada venta de cursos, a precio de lista y antes de la comisión de Mercado Pago." />
      <p className="fo-card text-sm text-[var(--fo-muted)]">
        Mientras el reparto automático de Mercado Pago esté apagado, cada venta la cobra quien vende, con su Mercado Pago, y la plataforma retiene su comisión.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Cobrado</p><p className="text-xl font-semibold">{pesos(r.cobradoCentavos)}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Pendiente</p><p className="text-xl font-semibold">{pesos(r.pendienteCentavos)}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Ventas cobradas</p><p className="text-xl font-semibold">{r.ventasAprobadas}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Vendido por tu sitio</p><p className="text-xl font-semibold">{pesos(r.vendidoCentavos)}</p></div>
      </div>
      {r.porCurso.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Por curso</h2>
          <ul className="fo-card divide-y divide-[var(--fo-border)]">
            {r.porCurso.map((c) => (
              <li key={c.curso} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>{c.curso} · {c.ventas} {c.ventas === 1 ? "venta" : "ventas"}</span>
                <span className="tabular-nums">{pesos(c.cobradoCentavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Detalle</h2>
        {filas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay ventas de cursos.</p>
        ) : (
          <ul className="fo-card divide-y divide-[var(--fo-border)]">
            {filas.map((f) => (
              <li key={f.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>
                  {fechaLegibleArgentina(f.fecha)} · {f.curso} · {ROTULO_DE_PARTE[f.kind]} · {ESTADO_DE_PAGO[f.estadoPago] ?? f.estadoPago}
                </span>
                <span className="tabular-nums">{pesos(f.montoCentavos)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
