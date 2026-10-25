import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { puedeGestionarPresupuestos, QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { listadoPresupuestos } from "@/lib/presupuestos/listado";
import { requirePresupuestos } from "@/lib/presupuestos/pagina";
import { botEnPanel } from "@/lib/dnx-bot/panel";
import { presupuestosSinRespuesta } from "@/lib/dnx-bot/seguimientos";
import { PreguntaleAlBot } from "@/components/dnx-bot/preguntale-al-bot";

export const dynamic = "force-dynamic";

/**
 * Lista de Presupuestos (motor de listas 0.2): número, contacto, consulta, estado, total, vence y
 * responsable; filtros por estado y vencidos; lote "Marcar vencidos" (con "Gestionar"). Nunca
 * muestra costos.
 */
export default async function PresupuestosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, ctx } = await requirePresupuestos("ver");
  const [ctxListado, bot] = await Promise.all([contextoListadoDePagina(user, workspace, QUOTES_MODULE_KEY), botEnPanel()]);
  // «Seguimientos» sólo si hay presupuestos sin respuesta (y el bot está encendido).
  const sinRespuesta = bot ? (await presupuestosSinRespuesta(ctx).catch(() => null))?.presupuestos.length ?? 0 : 0;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Presupuestos"
        description="Los presupuestos de las consultas, con su estado y vencimiento."
        actions={
          <div className="flex flex-wrap gap-2">
            {/* DNX Bot (etapa 2): sólo si está encendido y la persona puede usar ¿Cuánto Cobro?. */}
            {bot?.capacidades.configurar ? (
              <PreguntaleAlBot etiqueta="¿Cuánto cobro esto?" mensaje="Quiero saber cuánto cobrar un trabajo." contexto={{ pantalla: "presupuestos" }} />
            ) : null}
            {sinRespuesta > 0 ? (
              <PreguntaleAlBot etiqueta={`Seguimientos (${sinRespuesta})`} mensaje="¿Qué presupuestos tengo sin respuesta?" contexto={{ pantalla: "presupuestos" }} />
            ) : null}
            {puedeGestionarPresupuestos(ctx) ? (
              <Link href="/presupuestos/nuevo" className="fo-btn fo-btn-primary text-sm">
                Nuevo presupuesto
              </Link>
            ) : null}
          </div>
        }
      />
      <Listado def={listadoPresupuestos} ctx={ctxListado} ruta="/presupuestos" searchParams={searchParams} />
    </div>
  );
}
