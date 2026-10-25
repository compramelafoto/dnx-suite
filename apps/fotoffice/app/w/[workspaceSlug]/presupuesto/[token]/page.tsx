import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccionesPublicas } from "@/components/presupuestos/acciones-publicas";
import { PortfolioPublico } from "@/components/presupuestos/portfolio-publico";
import { portfolioDelEnlace } from "@/lib/presupuesto-automatico/portfolio";
import { ESTILO_IMPRESION, PresupuestoPublico } from "@/components/presupuestos/presupuesto-publico";
import { abrirPresupuestoPublico } from "@/lib/presupuestos/publico";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import type { VistaPublica } from "@/lib/presupuestos/vista-publica";
import { abreAlguienDelEquipo, visitanteDelEnlace } from "./visitante";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  // Es del cliente: no se indexa, y la dirección (que lleva el token) no se manda a ningún sitio
  // que se abra desde acá. El encabezado HTTP lo pone `next.config.ts`.
  return { title: "Presupuesto", robots: { index: false, follow: false }, referrer: "no-referrer" };
}

function Aviso({ vista }: { vista: VistaPublica }) {
  if (vista.estado === "ACEPTADO") {
    return (
      <div className="fo-card space-y-2 p-4">
        <p className="font-semibold">¡Gracias! Este presupuesto ya está aceptado.</p>
        {vista.pedidoUrl ? (
          <a href={vista.pedidoUrl} className="fo-btn fo-btn-primary text-sm" rel="noreferrer">
            Ver tu pedido y pagar la seña
          </a>
        ) : (
          <p className="text-sm">Te vamos a escribir para confirmar los detalles.</p>
        )}
      </div>
    );
  }
  if (vista.estado === "RECHAZADO") {
    return <p className="fo-card p-4">Este presupuesto ya no está disponible. Si te interesa, escribinos y armamos uno nuevo.</p>;
  }
  return null;
}

/**
 * El enlace público de un presupuesto (spec etapa 2 §3.3), sin sesión: el token es la llave.
 * Enlace desconocido, de otra organización, sin enviar o vencido hace más de 30 días: el 404
 * genérico del sitio. Una versión reemplazada no se muestra nunca: redirige al enlace de la vigente
 * (o 404 si no hay). Cada apertura queda registrada; la primera marca el presupuesto como visto.
 */
export default async function PresupuestoPublicoPage({ params }: Props) {
  const { workspaceSlug, token } = await params;
  const visitante = await visitanteDelEnlace();
  if (!visitante.permitido) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <p>Hubo demasiadas visitas desde tu conexión. Esperá unos minutos y volvé a abrir el enlace.</p>
      </main>
    );
  }
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) notFound();
  // Si lo abre alguien del equipo (con sesión), no cuenta como vista del cliente.
  const registrar = !(await abreAlguienDelEquipo(workspaceId));
  const r = await abrirPresupuestoPublico(workspaceId, token, { registrar, ipHash: visitante.ipHash, userAgent: visitante.userAgent });
  if (!r) notFound();
  if ("redirigir" in r) redirect(r.redirigir);
  const { vista } = r;
  // El portfolio del tipo de evento de la consulta (spec 2026-10-25): sólo mientras se puede aceptar.
  const portfolio = vista.estado === "ACTIVO" ? await portfolioDelEnlace(workspaceId, token) : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <style>{ESTILO_IMPRESION}</style>
      <Aviso vista={vista} />
      {portfolio ? <PortfolioPublico portfolio={portfolio} /> : null}
      <PresupuestoPublico vista={vista} />
      <AccionesPublicas
        slug={workspaceSlug}
        token={token}
        estado={vista.estado}
        whatsappUrl={vista.organizacion.whatsappUrl}
        email={vista.organizacion.email}
        // Relativo: sirve igual en `/w/<slug>/presupuesto/<token>` y en el dominio propio.
        hrefImprimir={`${encodeURIComponent(token)}/imprimir`}
        opciones={vista.opcionesPago}
      />
    </main>
  );
}
