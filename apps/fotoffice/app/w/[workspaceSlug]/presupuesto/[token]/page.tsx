import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccionesPublicas } from "@/components/presupuestos/acciones-publicas";
import { PortadaPresupuesto } from "@/components/presupuestos/portada-presupuesto";
import { PortfolioPublico } from "@/components/presupuestos/portfolio-publico";
import { leerAjustesCobro } from "@/lib/cobro-ajustes/ajustes";
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

  const activo = vista.estado === "ACTIVO";
  const pedidoAutomatico = activo ? (await leerAjustesCobro(workspaceId)).autoConfirmarPedido : false;

  return (
    <>
      <style>{ESTILO_IMPRESION}</style>
      <PortadaPresupuesto vista={vista} />
      <main className={`mx-auto ${activo || vista.alternativas.length >= 3 ? "max-w-6xl" : "max-w-3xl"} space-y-12 px-4 pb-32 pt-10 md:px-8 md:pt-14`}>
        <Aviso vista={vista} />
        {portfolio ? <PortfolioPublico portfolio={portfolio} /> : null}
        {/* Activo: la elección (opciones, formas de pago y confirmar) la dibuja `AccionesPublicas`;
            acá va el detalle (sin opciones); las condiciones se le pasan para que queden antes de confirmar. */}
        {activo ? (
          vista.alternativas.length === 0 ? (
            <section className="rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-surface)] p-6 shadow-sm md:p-8">
              <PresupuestoPublico vista={vista} encabezado={false} partes="detalle" />
            </section>
          ) : null
        ) : (
          <PresupuestoPublico vista={vista} encabezado={false} />
        )}
        <AccionesPublicas
          slug={workspaceSlug}
          token={token}
          estado={vista.estado}
          whatsappUrl={vista.organizacion.whatsappUrl}
          email={vista.organizacion.email}
          // Relativo: sirve igual en `/w/<slug>/presupuesto/<token>` y en el dominio propio.
          hrefImprimir={`${encodeURIComponent(token)}/imprimir`}
          opciones={vista.opcionesPago}
          total={vista.cobro && vista.cobro.iva > 0 ? vista.cobro.totalConIva : vista.totales.total}
          alternativas={vista.alternativas}
          pedidoAutomatico={pedidoAutomatico}
          condiciones={
            vista.condiciones || vista.propuestaPago || vista.cobro?.politicaCancelacion || (vista.cobro?.descuentoTransferencia ?? 0) > 0 ? (
              <section className="rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-surface-hover)] p-6 md:p-8">
                <PresupuestoPublico vista={vista} encabezado={false} partes="condiciones" />
              </section>
            ) : null
          }
        />
      </main>
    </>
  );
}
