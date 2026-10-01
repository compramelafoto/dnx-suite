import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { MasDatos } from "@/components/campos/mas-datos";
import { Historial } from "@/components/circuitos/historial";
import { Proyeccion } from "@/components/circuitos/proyeccion";
import { Recorrido } from "@/components/circuitos/recorrido";
import { Tareas } from "@/components/circuitos/tareas";
import { puede } from "@/lib/access/policy";
import { cambiosDeConsulta } from "@/lib/campos/ficha";
import { cargarFicha } from "@/lib/circuitos/ficha";
import { claveDeRecorrido } from "@/lib/circuitos/ficha-vista";
import { fechaBA, fechaHoraBA } from "@/lib/ficha/formato";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";

export const dynamic = "force-dynamic";

/** Los ids que llegan de la dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Ficha de una consulta de Captación. Primero la guarda (módulo encendido y rol que opera),
 * después la lectura acotada al workspace de la sesión: una consulta de otro workspace o
 * inexistente cae en `notFound()`.
 */
export default async function FichaConsultaPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const { id } = await params;
  if (!ID_VALIDO.test(id)) notFound();

  const [ficha, role] = await Promise.all([cargarFicha(workspace.id, id, new Date()), resolveWorkspaceRole(user.id, workspace.id)]);
  if (!ficha) notFound();
  // Recién con la consulta verificada en el workspace de la sesión: sus cambios de "Más datos".
  const cambios = await cambiosDeConsulta(workspace.id, id);

  const { consulta, recorrido } = ficha;
  const evento = [consulta.tipo, consulta.subtipo].filter(Boolean).join(" · ");
  const datos: { termino: string; valor: React.ReactNode }[] = [
    {
      termino: "Correo",
      valor: consulta.email ? (
        <a href={`mailto:${consulta.email}`} className="text-[var(--fo-accent)] hover:underline">
          {consulta.email}
        </a>
      ) : null,
    },
    {
      termino: "Teléfono",
      valor: consulta.telefono ? (
        <>
          {consulta.telefono}
          {consulta.whatsapp ? (
            <>
              {" · "}
              <a href={consulta.whatsapp} target="_blank" rel="noopener noreferrer" className="text-[var(--fo-accent)] hover:underline">
                WhatsApp
              </a>
            </>
          ) : null}
        </>
      ) : null,
    },
    { termino: "Evento", valor: evento },
    { termino: "Fecha del evento", valor: consulta.fechaEvento ? fechaBA(consulta.fechaEvento) : null },
    { termino: "Lugar", valor: consulta.lugar },
    { termino: "Formulario de origen", valor: consulta.formulario },
    { termino: "Alta", valor: fechaHoraBA(consulta.alta) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={consulta.nombre}
        description={evento}
        actions={
          <Link href="/captacion" className="fo-btn fo-btn-secondary text-sm">
            Volver a Captación
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4 self-start">
          <section aria-labelledby="datos-titulo" className="fo-card space-y-3">
            <h2 id="datos-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Datos de la consulta
            </h2>
            <dl className="space-y-2 text-sm">
              {datos.map((d) => (
                <div key={d.termino}>
                  <dt className="text-xs text-[var(--fo-muted)]">{d.termino}</dt>
                  <dd className="break-words text-[var(--fo-text)]">{d.valor || "—"}</dd>
                </div>
              ))}
            </dl>
            {consulta.mensaje ? (
              <div className="space-y-1 border-t border-[var(--fo-border)] pt-3">
                <p className="text-xs text-[var(--fo-muted)]">Mensaje</p>
                <p className="whitespace-pre-line break-words text-sm text-[var(--fo-text)]">{consulta.mensaje}</p>
              </div>
            ) : null}
          </section>
          <MasDatos entityType="CONSULTA" entityId={id} />
        </div>

        <div className="space-y-6">
          {recorrido ? (
            <>
              <Recorrido
                key={claveDeRecorrido(recorrido)}
                recorrido={recorrido}
                titulo={consulta.nombre}
                motivos={ficha.motivos}
                responsables={ficha.responsables}
                puedePasarIgual={puede(role, "configurar")}
              />
              <Tareas key={recorrido.id} journeyId={recorrido.id} tareas={ficha.tareas} abierto={recorrido.abierto} />
              {ficha.proyeccion ? <Proyeccion proyeccion={ficha.proyeccion} /> : null}
              <Historial pasos={ficha.historial} cambios={cambios} />
            </>
          ) : (
            <>
              <p className="fo-card text-sm text-[var(--fo-muted)]">
                Esta consulta todavía no está en ningún circuito. Se ordena sola al abrir el tablero de Captación.
              </p>
              {cambios.length > 0 ? <Historial pasos={[]} cambios={cambios} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
