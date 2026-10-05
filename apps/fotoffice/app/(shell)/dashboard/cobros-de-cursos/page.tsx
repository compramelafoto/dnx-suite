// app/(shell)/dashboard/cobros-de-cursos/page.tsx
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireDuenoOAdminDelNegocio } from "@/lib/course-marketplace/access";
import {
  ESTADO_DE_PAGO,
  ROTULO_DE_PARTE,
  centavosDeDecimal,
  resumirGrupos,
  type FilaCobro,
  type GrupoCobro,
  type ResumenCobros,
} from "@/lib/course-marketplace/cobros";
import { pesos } from "@/lib/course-marketplace/formato";
import { fechaLegibleArgentina } from "@/lib/course-classroom/access-rules";

export const dynamic = "force-dynamic";

/** Tope de la lista visible. Los totales no lo usan: se agrupan en la base sobre todas las filas. */
const LIMITE_DE_DETALLE = 200;

type Cobros = { r: ResumenCobros; filas: FilaCobro[]; total: number };

async function cargarCobros(workspaceId: string): Promise<Cobros> {
  const [grupos, vendido, total, detalle] = await Promise.all([
    // Lo de este negocio, por curso y estado, sobre TODAS sus partes. Montos como texto: sin float.
    prisma.$queryRaw<Array<{ cursoId: string; curso: string; estado: string; ventas: number; monto: string }>>`
      SELECT e."courseId" AS "cursoId", c.title AS curso, e."paymentStatus"::text AS estado,
             COUNT(DISTINCT e.id)::int AS ventas, COALESCE(SUM(s."amountArs"), 0)::text AS monto
      FROM "CourseSaleShare" s
      JOIN "CourseEnrollment" e ON e.id = s."enrollmentId"
      JOIN "Course" c ON c.id = e."courseId"
      WHERE s."workspaceId" = ${workspaceId}
      GROUP BY e."courseId", c.title, e."paymentStatus"`,
    // Lo que pagaron los alumnos en las ventas hechas por este negocio (cada venta una vez).
    prisma.courseEnrollment.aggregate({
      where: { workspaceId, paymentStatus: "APPROVED", saleShares: { some: { workspaceId } } },
      _sum: { amountArs: true },
    }),
    prisma.courseSaleShare.count({ where: { workspaceId } }),
    prisma.courseSaleShare.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: LIMITE_DE_DETALLE,
      select: {
        id: true,
        kind: true,
        amountArs: true,
        createdAt: true,
        enrollment: {
          select: { id: true, workspaceId: true, paymentStatus: true, amountArs: true, course: { select: { title: true } } },
        },
      },
    }),
  ]);
  const r = resumirGrupos(
    grupos.map((g): GrupoCobro => ({ cursoId: g.cursoId, curso: g.curso, estado: g.estado, ventas: Number(g.ventas), montoCentavos: centavosDeDecimal(g.monto) })),
    centavosDeDecimal(vendido._sum.amountArs?.toFixed(2)),
  );
  const filas: FilaCobro[] = detalle.map((p) => ({
    id: p.id,
    enrollmentId: p.enrollment.id,
    kind: p.kind,
    montoCentavos: centavosDeDecimal(p.amountArs.toFixed(2)),
    pagaElAlumnoCentavos: centavosDeDecimal(p.enrollment.amountArs.toFixed(2)),
    curso: p.enrollment.course.title,
    fecha: p.createdAt,
    estadoPago: p.enrollment.paymentStatus,
    vendioEsteNegocio: p.enrollment.workspaceId === workspaceId,
  }));
  return { r, filas, total };
}

/**
 * No exige el módulo de cursos: un docente o una productora pueden cobrar su parte sin vender
 * cursos ellos mismos. Sí exige ser dueño o admin: es plata (el menú usa la misma regla,
 * `requiresFullAccess`).
 */
export default async function CobrosDeCursosPage() {
  const { workspace } = await requireDuenoOAdminDelNegocio();
  let datos: Cobros;
  try {
    datos = await cargarCobros(workspace.id);
  } catch (error) {
    // Sin datos personales: sólo el tipo y el código del error.
    console.error("[cobros-de-cursos] no se pudieron leer los cobros", {
      tipo: error instanceof Error ? error.name : typeof error,
      codigo: (error as { code?: unknown })?.code ?? null,
    });
    return (
      <div className="space-y-8">
        <PageHeader title="Cobros" />
        <p className="fo-card text-sm text-[var(--fo-muted)]">No pudimos cargar tus cobros ahora. Probá de nuevo en unos minutos.</p>
      </div>
    );
  }
  const { r, filas, total } = datos;

  return (
    <div className="space-y-8">
      <PageHeader title="Cobros" description="Lo que vendiste y lo que te tocó de cada venta de cursos, antes de la comisión de Mercado Pago." />
      <p className="fo-card text-sm text-[var(--fo-muted)]">
        Mientras el reparto automático de Mercado Pago esté apagado, cada venta la cobra quien vende, con su Mercado Pago, y la plataforma retiene su comisión.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Cobrado</p><p className="text-xl font-semibold">{pesos(r.cobradoCentavos)}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Pendiente</p><p className="text-xl font-semibold">{pesos(r.pendienteCentavos)}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Ventas cobradas</p><p className="text-xl font-semibold">{r.ventasAprobadas}</p></div>
        <div className="fo-card"><p className="text-xs text-[var(--fo-muted)]">Pagado por los alumnos de tu sitio</p><p className="text-xl font-semibold">{pesos(r.vendidoCentavos)}</p><p className="text-xs text-[var(--fo-muted)]">Total que pagaron, con el cargo por servicio y descontados los descuentos.</p></div>
      </div>
      {r.porCurso.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Por curso</h2>
          <ul className="fo-card divide-y divide-[var(--fo-border)]">
            {r.porCurso.map((c) => (
              <li key={c.cursoId} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                <span>{c.curso} · {c.ventas} {c.ventas === 1 ? "venta" : "ventas"}</span>
                <span className="tabular-nums">{pesos(c.cobradoCentavos)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Detalle</h2>
        {total > filas.length ? <p className="text-xs text-[var(--fo-muted)]">Mostrando los últimos {filas.length} de {total}. Los totales de arriba cuentan todas las ventas.</p> : null}
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
