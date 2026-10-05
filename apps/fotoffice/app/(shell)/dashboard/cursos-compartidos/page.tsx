import Link from "next/link";
import { prisma } from "@repo/db";
import { requireDuenoOAdminDelNegocio, invitacionesPendientesWhere } from "@/lib/course-marketplace/access";
import { cargarBeneficiarios, cargarDueno } from "@/lib/course-marketplace/cargar";
import { beneficiariosParaMotor } from "@/lib/course-marketplace/beneficiarios";
import { armarEscenarios } from "@/lib/course-marketplace/escenarios";
import { formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { SimuladorReparto } from "@/components/course-marketplace/simulador-reparto";
import { responderInvitacionAction } from "@/app/actions/course-beneficiaries";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";

export const dynamic = "force-dynamic";

const MENSAJES: Record<string, string> = {
  aceptada: "Aceptaste. Vas a cobrar tu parte de cada venta.",
  rechazada: "Rechazaste la invitación.",
  "no-encontrada": "Esa invitación ya no está disponible.",
  "ya-sos-beneficiario": "Tu negocio ya es beneficiario de ese curso.",
};

const ROLES: Record<string, string> = {
  DOCENTE: "Docente",
  PRODUCTOR: "Productor",
  INSTITUCION: "Institución",
  OTRO: "Otro",
};

function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(centavos / 100);
}

export default async function CursosCompartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const { user, workspace } = await requireDuenoOAdminDelNegocio();
  const { r } = await searchParams;
  const mensaje = r && Object.hasOwn(MENSAJES, r) ? MENSAJES[r] : null;

  // Si la tabla todavía no existe en la base, la pantalla se muestra vacía en vez de caerse.
  let tablaFaltante = false;
  const [consultaInvitaciones, collector] = await Promise.all([
    Promise.all([
      prisma.courseBeneficiary.findMany({
        where: invitacionesPendientesWhere(workspace.id, user.email),
        include: { course: { select: { id: true, title: true, workspaceId: true, priceArs: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.courseBeneficiary.findMany({
        where: { workspaceId: workspace.id, status: "ACEPTADO", course: { workspaceId: { not: workspace.id } } },
        include: { course: { select: { id: true, title: true, workspaceId: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]).catch(() => {
      tablaFaltante = true;
      console.error("[cursos-compartidos] no se pudieron leer las invitaciones");
      return null;
    }),
    resolveWorkspaceCollector(workspace.id),
  ]);
  const [pendientes, aceptadas] = consultaInvitaciones ?? [[], []];

  const tarjetas = await Promise.all(
    pendientes.map(async (fila) => {
      const [dueno, registrados, feeBps] = await Promise.all([
        cargarDueno(fila.course.workspaceId),
        cargarBeneficiarios(fila.courseId),
        getPlatformFeeBps(fila.course.workspaceId, COURSES_SALES_MODULE_KEY),
      ]);
      const paraMotor = beneficiariosParaMotor(dueno, registrados);
      const listaCentavos = Math.round(Number(fila.course.priceArs ?? 0) * 100);
      // Mismo criterio de id que `beneficiariosParaMotor`.
      const destacarId = fila.workspaceId ?? fila.id;
      const directa = armarEscenarios({
        listaCentavos,
        comisionPlataformaBps: feeBps,
        beneficiarios: paraMotor,
        vendedorId: dueno.workspaceId,
        reventaBps: 2500,
      }).find((e) => e.clave === "directa");
      const miParte = directa?.ok ? directa.filas.find((f) => f.id === destacarId)?.bruto ?? null : null;
      return { fila, dueno, paraMotor, feeBps, listaCentavos, destacarId, miParte };
    }),
  );

  const duenosAceptadas = await Promise.all(aceptadas.map((a) => cargarDueno(a.course.workspaceId)));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--fo-text)]">Cursos compartidos</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
          Otros negocios te sumaron para cobrar una parte de las ventas de sus cursos. Mirá cómo se reparte y aceptá o rechazá.
        </p>
      </header>

      {mensaje ? (
        <div className="fo-card" role="status">
          <p className="text-sm text-[var(--fo-text)]">{mensaje}</p>
        </div>
      ) : null}

      {!collector.ok && pendientes.length > 0 ? (
        <div className="fo-card fo-alert-warning" role="status">
          <p className="text-sm text-[var(--fo-text)]">
            Para cobrar tu parte vas a tener que{" "}
            <Link href="/workspace/configuracion/cobros" className="underline">
              conectar Mercado Pago
            </Link>
            .
          </p>
        </div>
      ) : null}

      <section className="space-y-4" aria-label="Invitaciones pendientes">
        <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
        {tarjetas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">{tablaFaltante ? "Todavía no hay invitaciones." : "No tenés invitaciones pendientes."}</p>
        ) : (
          tarjetas.map(({ fila, dueno, paraMotor, feeBps, listaCentavos, destacarId, miParte }) => (
            <article key={fila.id} className="fo-card space-y-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">{fila.course.title}</h3>
                <p className="text-sm text-[var(--fo-muted)]">
                  Lo ofrece {dueno.nombre} · Tu rol: {ROLES[fila.role] ?? fila.role} · Tu parte: {formatoPorcentaje(fila.shareBps)}
                  {fila.absorbsProcessorFee ? " · Absorbés la comisión de Mercado Pago" : ""}
                </p>
                {miParte !== null && listaCentavos > 0 ? (
                  <p className="text-sm">
                    Por cada venta de {pesos(listaCentavos)} a precio de lista recibís <strong>{pesos(miParte)}</strong>.
                  </p>
                ) : null}
              </div>
              <SimuladorReparto
                listaCentavos={listaCentavos}
                comisionPlataformaBps={feeBps}
                beneficiarios={paraMotor}
                vendedorId={dueno.workspaceId}
                destacarId={destacarId}
              />
              <div className="flex flex-wrap gap-3">
                <form action={responderInvitacionAction.bind(null, fila.id, true)}>
                  <button type="submit" className="fo-btn fo-btn-primary">
                    Aceptar
                  </button>
                </form>
                <form action={responderInvitacionAction.bind(null, fila.id, false)}>
                  <button type="submit" className="fo-btn fo-btn-secondary">
                    Rechazar
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3" aria-label="Cursos donde sos beneficiario">
        <h2 className="text-lg font-semibold">Cursos donde sos beneficiario</h2>
        {aceptadas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no cobrás una parte de ningún curso de otro negocio.</p>
        ) : (
          <ul className="fo-card divide-y divide-[var(--fo-border)]">
            {aceptadas.map((a, i) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{a.course.title}</strong> · {duenosAceptadas[i].nombre}
                </span>
                <span>{formatoPorcentaje(a.shareBps)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
