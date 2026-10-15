import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCashConfigurer } from "@/lib/cash/access";
import { leerLote } from "@/lib/historico-caja/repositorio";
import { ETIQUETA_CLASE, ETIQUETA_MOTIVO, esMes } from "@/lib/historico-caja/tipos";
import { confirmarMesAction, descartarMesAction } from "../actions";
import { Estado, Pesos, Tabla } from "../vista";

export const dynamic = "force-dynamic";

export default async function HistorialMesPage({
  params,
  searchParams,
}: {
  params: Promise<{ mes: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { workspace } = await requireCashConfigurer();
  const { mes } = await params;
  const sp = await searchParams;
  if (!esMes(mes)) notFound();
  const datos = await leerLote(prisma, workspace.id, mes);
  if (!datos) notFound();
  const { lote, revisar, totalRevisar } = datos;
  const r = lote.resumen;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Historial importado · ${mes}`}
        description={`Archivo: ${lote.archivo}. ${r.filas} movimientos del libro${r.estimados.length ? ` y ${r.estimados.length} estimados` : ""}.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Estado estado={lote.estado} />
            {lote.estado === "BORRADOR" ? (
              <form action={confirmarMesAction}>
                <input type="hidden" name="mes" value={mes} />
                <button className="fo-btn fo-btn-primary text-sm">Confirmar mes</button>
              </form>
            ) : null}
            {lote.estado !== "DESCARTADO" ? (
              <form action={descartarMesAction}>
                <input type="hidden" name="mes" value={mes} />
                <button className="fo-btn fo-btn-ghost text-sm">Descartar</button>
              </form>
            ) : null}
          </div>
        }
      />
      <Link href="/caja/historial" className="text-sm underline-offset-2 hover:underline">
        ← Todos los meses
      </Link>
      {sp.ok ? <p className="text-sm text-[var(--fo-success)]">{sp.ok === "confirmado" ? "Mes confirmado." : "Mes descartado."}</p> : null}
      {sp.error ? <p className="text-sm text-[var(--fo-danger)]">{sp.error}</p> : null}

      {r.avisos.map((a) => (
        <p key={a} className="rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-3 text-sm">
          {a}
        </p>
      ))}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="fo-card p-4">
          <p className="text-sm text-[var(--fo-muted)]">Ingresos</p>
          <p className="text-xl font-semibold"><Pesos centavos={r.ingresosCentavos} /></p>
          <p className="text-xs text-[var(--fo-muted-soft)]">
            Efectivo <Pesos centavos={r.ingresosEfectivoCentavos} /> · Digital <Pesos centavos={r.ingresosDigitalCentavos} />
          </p>
        </div>
        <div className="fo-card p-4">
          <p className="text-sm text-[var(--fo-muted)]">Gastos fijos (anotados + estimados)</p>
          <p className="text-xl font-semibold"><Pesos centavos={r.porClase.GASTO_FIJO} positivo /></p>
          {r.estimadosCentavos ? <p className="text-xs text-[var(--fo-muted-soft)]">Estimados: <Pesos centavos={r.estimadosCentavos} positivo /></p> : null}
        </div>
        <div className="fo-card p-4">
          <p className="text-sm text-[var(--fo-muted)]">Resultado del mes</p>
          <p className="text-xl font-semibold"><Pesos centavos={r.resultadoCentavos} /></p>
          <p className="text-xs text-[var(--fo-muted-soft)]">Sin retiro del dueño ni movimientos internos.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Por línea y por clase</h2>
        <Tabla columnas={[{ titulo: "Clase" }, { titulo: "Rubro" }, { titulo: "Movimientos", derecha: true }, { titulo: "Importe", derecha: true }]}>
          {r.porRubro.map((t) => (
            <tr key={`${t.clase}-${t.codigo ?? "sin"}`}>
              <td className="px-4 py-2 text-[var(--fo-muted)]">{ETIQUETA_CLASE[t.clase]}</td>
              <td className="px-4 py-2">
                {t.codigo ? `${t.codigo} ` : ""}
                {t.nombre}
                {t.estimadoCentavos ? <span className="ml-2 text-xs text-[var(--fo-muted-soft)]">(estimado)</span> : null}
              </td>
              <td className="px-4 py-2 text-right text-[var(--fo-muted)]">{t.cantidad}</td>
              <td className="px-4 py-2 text-right"><Pesos centavos={t.centavos} /></td>
            </tr>
          ))}
        </Tabla>
      </section>

      {r.faltantes.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">No encontramos</h2>
          <p className="text-sm text-[var(--fo-muted)]">Gastos que se repetían en los meses anteriores y este mes no están.</p>
          <ul className="list-disc space-y-1 pl-6 text-sm">
            {r.faltantes.map((f) => (
              <li key={`${f.rubroCodigo}-${f.concepto}`}>
                {f.concepto} {f.rubroNombre ? `(${f.rubroNombre})` : ""} — en {f.mesesVistos} de los 6 meses anteriores
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Para revisar ({totalRevisar})</h2>
        {revisar.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Nada marcado en este mes.</p>
        ) : (
          <Tabla minimo={720} columnas={[{ titulo: "Fecha" }, { titulo: "Concepto" }, { titulo: "Importe", derecha: true }, { titulo: "Rubro" }, { titulo: "Por qué" }]}>
            {revisar.map((m, i) => (
              <tr key={i}>
                <td className="px-4 py-2 whitespace-nowrap">{m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)}</td>
                <td className="px-4 py-2">
                  {m.concepto}
                  {m.referencia ? <div className="text-xs text-[var(--fo-muted-soft)]">{m.referencia}</div> : null}
                </td>
                <td className="px-4 py-2 text-right"><Pesos centavos={m.centavos} /></td>
                <td className="px-4 py-2 text-[var(--fo-muted)]">{m.rubro ?? "Sin clasificar"}</td>
                <td className="px-4 py-2 text-xs">{m.motivos.map((x) => ETIQUETA_MOTIVO[x]).join(" · ")}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </section>
    </div>
  );
}
