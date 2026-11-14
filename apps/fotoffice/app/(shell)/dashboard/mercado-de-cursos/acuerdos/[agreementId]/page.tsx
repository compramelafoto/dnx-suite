import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { cargarCursoCompartido } from "@/lib/course-marketplace/compartidos";
import { BPS_TOTAL, formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { pesos } from "@/lib/course-marketplace/formato";

export const dynamic = "force-dynamic";

const ESTADOS = { PENDIENTE: "Esperando respuesta", ACTIVO: "Activo", PAUSADO: "Pausado", RECHAZADO: "Rechazado", TERMINADO: "Terminado" } as const;
const ORIGENES = { PURCHASE: "Compra", MEMBER_BENEFIT: "Gratis por ser socio", INVITATION: "Invitación" } as const;

/**
 * Un curso compartido, en modo lectura, para las dos puntas del acuerdo. Sólo el dueño edita el
 * curso (desde su ficha); acá se ven las condiciones, las clases y los alumnos del espacio que lo recibe.
 */
export default async function CursoCompartidoPage({ params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = await params;
  const { workspace } = await requireCoursesSalesContext("VIEW");
  const vista = await cargarCursoCompartido(agreementId, workspace.id);
  if (!vista) notFound();
  const { acuerdo, curso } = vista;
  const listaCentavos = Math.round(Number(curso.precioArs ?? 0) * 100);
  const parte = Math.round((listaCentavos * acuerdo.shareBps) / BPS_TOTAL);

  return (
    <div className="space-y-6">
      <PageHeader
        title={curso.titulo}
        description={vista.soyDueno ? `Compartido con ${vista.espacio}.` : `Curso de ${vista.dueno}, compartido con tu espacio.`}
        actions={
          <div className="flex flex-wrap gap-2">
            {vista.soyDueno ? (
              <Link href={`/dashboard/courses/${curso.id}`} className="fo-btn fo-btn-secondary text-sm">
                Editar curso
              </Link>
            ) : null}
            <Link href="/dashboard/mercado-de-cursos/acuerdos" className="fo-btn fo-btn-secondary text-sm">
              Volver a cursos compartidos
            </Link>
          </div>
        }
      />

      <section className="fo-card space-y-1 text-sm">
        <p>
          <strong>Estado:</strong> {ESTADOS[acuerdo.status]}
          {acuerdo.invitadoPorDueno ? " · lo compartió el dueño" : " · lo pidió el espacio"}
        </p>
        <p>
          <strong>Precio:</strong> {listaCentavos > 0 ? pesos(listaCentavos) : "sin precio"} (lo fija {vista.dueno}, igual en todos los espacios)
        </p>
        <p>
          <strong>{vista.soyDueno ? `Parte de ${vista.espacio}` : "Tu parte"}:</strong>{" "}
          {acuerdo.shareBps === BPS_TOTAL ? "todo lo que venda (regalado)" : `${formatoPorcentaje(acuerdo.shareBps)} de cada venta (${pesos(parte)})`}
        </p>
        <p>
          <strong>Socios de {vista.espacio}:</strong> {acuerdo.membersFree ? "lo toman gratis desde su portal" : "lo compran"}
        </p>
        {curso.docente ? (
          <p>
            <strong>Docente:</strong> {curso.docente}
          </p>
        ) : null}
        {curso.descripcion ? <p className="text-[var(--fo-muted)]">{curso.descripcion}</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Clases</h2>
        {vista.clases.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no tiene clases.</p>
        ) : (
          <ol className="fo-card list-decimal space-y-1 pl-8 text-sm">
            {vista.clases.map((c) => (
              <li key={c.id}>
                {c.titulo}
                {c.minutos ? ` · ${c.minutos} min` : ""}
                {c.muestra ? " · clase de muestra" : ""}
                {c.lista ? "" : " · en preparación"}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Alumnos de {vista.espacio}</h2>
        {vista.alumnos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía nadie lo tomó por este espacio.</p>
        ) : (
          <ul className="fo-card space-y-1 text-sm">
            {vista.alumnos.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {a.nombre || a.correo} <span className="text-[var(--fo-muted)]">· {a.correo}</span>
                </span>
                <span className="text-[var(--fo-muted)]">
                  {ORIGENES[a.origen]} · {a.porcentaje}% visto
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
