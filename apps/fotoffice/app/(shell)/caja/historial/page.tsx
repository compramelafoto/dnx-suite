import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCashConfigurer } from "@/lib/cash/access";
import { egresosPorClase, ingresosPorLinea, promedioFijos, puntoDeEquilibrio } from "@/lib/historico-caja/analitica";
import { filasAnaliticasConfirmadas, listarLotes } from "@/lib/historico-caja/repositorio";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { formatMinorArs } from "@/lib/membership/money";
import { Estado, Pesos, Tabla } from "./vista";

export const dynamic = "force-dynamic";

/**
 * Historial importado (etapa E, spec 7.6): los libros de caja viejos, mes por mes. No es Caja: no
 * cambia saldos ni arqueos. Cada mes se revisa y se confirma; la analítica sólo suma los confirmados.
 */
export default async function HistorialPage() {
  const { workspace } = await requireCashConfigurer();
  const [lotes, analitica] = await Promise.all([listarLotes(prisma, workspace.id), filasAnaliticasConfirmadas(prisma, workspace.id)]);
  const mesActual = hoyEnBuenosAires(new Date()).slice(0, 7);
  const promedio = promedioFijos(analitica.filas, { mesActual, incompletos: analitica.mesesConAvisos });
  const enMeses = analitica.filas.filter((f) => promedio.meses.includes(f.mes));
  const ingresos = ingresosPorLinea(enMeses).totalPorMes.reduce((s, v) => s + v, 0) / 3;
  const variables = egresosPorClase(enMeses).clases.find((c) => c.clase === "COSTO_VARIABLE")?.total ?? 0;
  const pe = puntoDeEquilibrio({
    fijosMensualesCentavos: promedio.promedioCentavos,
    retiroMensualCentavos: 0,
    ingresosCentavos: Math.round(ingresos),
    costosVariablesCentavos: Math.round(variables / 3),
  });
  const hayConfirmados = analitica.filas.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Historial importado"
        description="Los libros de caja anteriores a FOTOFFICE, mes por mes. No cambian el saldo de hoy: sirven para comparar y calcular los fijos reales."
      />

      {lotes.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Todavía no se importó ningún mes. La carga se hace con el comando <code>caja:importar-historico</code> (un CSV y un archivo de
          mapeo); cada mes aparece acá como &ldquo;Para revisar&rdquo;.
        </p>
      ) : null}

      {hayConfirmados ? (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="fo-card space-y-1 p-4">
            <p className="text-sm text-[var(--fo-muted)]">Gastos fijos reales, promedio de {promedio.meses.join(", ")}</p>
            <p className="text-2xl font-semibold">{formatMinorArs(promedio.promedioCentavos)}</p>
            {promedio.incluyeEstimados ? <p className="text-xs text-[var(--fo-muted-soft)]">Incluye gastos estimados.</p> : null}
            {promedio.mesesSinDatos.length ? <p className="text-xs text-[var(--fo-danger)]">Sin datos: {promedio.mesesSinDatos.join(", ")}.</p> : null}
            {promedio.mesesIncompletos.length ? <p className="text-xs text-[var(--fo-danger)]">Fijos incompletos: {promedio.mesesIncompletos.join(", ")}.</p> : null}
          </div>
          <div className="fo-card space-y-1 p-4">
            <p className="text-sm text-[var(--fo-muted)]">Punto de equilibrio (sin retiro del dueño)</p>
            <p className="text-2xl font-semibold">
              {pe.ventasNecesariasCentavos !== null ? formatMinorArs(pe.ventasNecesariasCentavos) : "—"}
            </p>
            <p className="text-xs text-[var(--fo-muted-soft)]">
              Ventas por mes para cubrir {formatMinorArs(pe.contribucionNecesariaCentavos)} de fijos
              {pe.margenContribucion !== null ? `, con un margen de contribución del ${Math.round(pe.margenContribucion * 1000) / 10} %` : ""}.
            </p>
          </div>
        </section>
      ) : null}

      {lotes.length > 0 ? (
        <Tabla
          minimo={760}
          columnas={[
            { titulo: "Mes" },
            { titulo: "Estado" },
            { titulo: "Ingresos", derecha: true },
            { titulo: "Egresos del libro", derecha: true },
            { titulo: "Estimados", derecha: true },
            { titulo: "Para revisar", derecha: true },
            { titulo: "Avisos" },
          ]}
        >
          {lotes.map((l) => (
            <tr key={l.mes}>
              <td className="px-4 py-2 font-medium">
                <Link href={`/caja/historial/${l.mes}`} className="underline-offset-2 hover:underline">
                  {l.mes}
                </Link>
              </td>
              <td className="px-4 py-2">
                <Estado estado={l.estado} />
              </td>
              <td className="px-4 py-2 text-right">
                <Pesos centavos={l.ingresosCentavos} />
              </td>
              <td className="px-4 py-2 text-right">
                <Pesos centavos={l.egresosCentavos} positivo />
              </td>
              <td className="px-4 py-2 text-right">{l.estimadosCentavos ? <Pesos centavos={l.estimadosCentavos} positivo /> : "—"}</td>
              <td className="px-4 py-2 text-right">{l.filasRevisar || "—"}</td>
              <td className="px-4 py-2 text-xs text-[var(--fo-muted)]">{l.avisos.length ? "Sí" : "—"}</td>
            </tr>
          ))}
        </Tabla>
      ) : null}
    </div>
  );
}
