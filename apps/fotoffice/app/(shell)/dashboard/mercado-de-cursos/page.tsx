import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { cargarMercado, puedePedirReventa } from "@/lib/course-marketplace/mercado";
import { formatoPorcentaje } from "@/lib/course-marketplace/reparto";
import { pesos } from "@/lib/course-marketplace/formato";
import { PedirReventaForm } from "@/components/course-marketplace/pedir-reventa-form";

export const dynamic = "force-dynamic";

const ESTADO_DE_MI_ACUERDO = {
  PENDIENTE: "Tu pedido espera la aprobación del dueño.",
  ACTIVO: "Lo estás vendiendo.",
  PAUSADO: "El acuerdo está pausado.",
  RECHAZADO: "El dueño rechazó tu pedido. Podés pedirlo de nuevo.",
  TERMINADO: "El acuerdo terminó. Podés pedirlo de nuevo.",
} as const;

export default async function MercadoDeCursosPage() {
  const { user, workspace } = await requireCoursesSalesContext("VIEW");
  const [{ comisionPlataformaBps, cursos }, puedePedir] = await Promise.all([
    cargarMercado(workspace.id),
    puedePedirReventa(user.id, workspace.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mercado de cursos"
        description="Cursos grabados de otros negocios que podés vender en tu sitio y en el portal de tus socios, quedándote con un porcentaje de cada venta."
        actions={
          <Link href="/dashboard/mercado-de-cursos/acuerdos" className="fo-btn fo-btn-secondary text-sm">
            Mis acuerdos
          </Link>
        }
      />
      {cursos.length === 0 ? (
        <p className="fo-card text-sm text-[var(--fo-muted)]">Todavía nadie ofrece cursos para revender.</p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {cursos.map((c) => {
            const sePuedePedir = !c.miAcuerdo || c.miAcuerdo.status === "RECHAZADO" || c.miAcuerdo.status === "TERMINADO";
            return (
              <li key={c.courseId} className="fo-card space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">{c.titulo}</h2>
                  <p className="text-sm text-[var(--fo-muted)]">
                    De {c.dueno.nombre}
                    {c.docente ? ` · Docente: ${c.docente}` : ""} · {c.clases} {c.clases === 1 ? "clase" : "clases"}
                  </p>
                  <p className="text-sm">
                    Precio de lista <strong>{pesos(c.listaCentavos)}</strong> · Sugerido para revendedores{" "}
                    <strong>{formatoPorcentaje(c.sugeridoBps)}</strong>
                  </p>
                  {c.muestraUrl ? (
                    <a href={c.muestraUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--fo-accent)] underline">
                      Ver la clase de muestra
                    </a>
                  ) : null}
                </div>
                {c.miAcuerdo ? <p className="text-sm font-medium">{ESTADO_DE_MI_ACUERDO[c.miAcuerdo.status]}</p> : null}
                {sePuedePedir && puedePedir ? (
                  <PedirReventaForm
                    courseId={c.courseId}
                    listaCentavos={c.listaCentavos}
                    comisionPlataformaBps={comisionPlataformaBps}
                    beneficiarios={c.beneficiarios}
                    sugeridoBps={c.sugeridoBps}
                  />
                ) : sePuedePedir ? (
                  <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador de tu negocio puede pedir una reventa.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
