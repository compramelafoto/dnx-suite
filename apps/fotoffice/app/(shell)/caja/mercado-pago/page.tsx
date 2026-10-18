import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCashConfigurer } from "@/lib/cash/access";
import { buscarCobrosMp } from "@/lib/cash/mp-cobros-server";
import { ESTADOS_COBRO } from "@/lib/cash/mp-cobros";
import { formatMinorArs } from "@/lib/membership/money";

export const dynamic = "force-dynamic";

const OPCIONES_HORAS = [2, 24, 72, 168] as const;

function fecha(d: Date | null) {
  return d ? d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" }) : "—";
}

/**
 * Lo que entró a la cuenta de Mercado Pago del negocio, leído en el momento. Sólo dueño o admin
 * (`cash.configure`): muestra la plata de la cuenta, no sólo la del mostrador.
 */
export default async function CobrosMercadoPagoPage({ searchParams }: { searchParams: Promise<{ horas?: string }> }) {
  const { workspace } = await requireCashConfigurer();
  const params = await searchParams;
  const horas = OPCIONES_HORAS.find((h) => String(h) === params.horas) ?? 24;
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - horas * 3_600_000);
  const resultado = await buscarCobrosMp(workspace.id, desde, hasta);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobros en Mercado Pago"
        description="Lo que entró a la cuenta de Mercado Pago del negocio, leído en el momento."
      />

      <div className="flex flex-wrap gap-2">
        {OPCIONES_HORAS.map((h) => (
          <Link
            key={h}
            href={`/caja/mercado-pago?horas=${h}`}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              h === horas
                ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
                : "border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]"
            }`}
          >
            {h < 24 ? `Últimas ${h} h` : h === 24 ? "Último día" : `Últimos ${h / 24} días`}
          </Link>
        ))}
      </div>

      {!resultado.ok ? (
        <div className="fo-card space-y-2 p-5 text-sm">
          <p className="text-[var(--fo-danger)]">
            {resultado.motivo === "SIN_CONEXION"
              ? "La cuenta de Mercado Pago no está conectada."
              : resultado.motivo === "RECONECTAR"
                ? "Mercado Pago no aceptó el permiso: hay que reconectar la cuenta."
                : "Mercado Pago no respondió. Probá de nuevo en un rato."}
          </p>
          {resultado.motivo !== "ERROR_MP" ? (
            <Link href="/workspace/configuracion/cobros" className="fo-btn fo-btn-secondary text-sm">
              Ir a Cobros
            </Link>
          ) : null}
        </div>
      ) : resultado.cobros.length === 0 ? (
        <p className="fo-card p-6 text-center text-sm text-[var(--fo-muted)]">No entró nada en este período.</p>
      ) : (
        <div className="fo-card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--fo-border)] text-left text-xs uppercase tracking-wide text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">De quién</th>
                <th className="px-4 py-3 font-medium">Medio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)]">
              {resultado.cobros.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap px-4 py-3">{fecha(c.fecha)}</td>
                  <td className="px-4 py-3">
                    {c.pagador ?? <span className="text-[var(--fo-muted)]">Sin dato</span>}
                    {c.descripcion ? <p className="text-xs text-[var(--fo-muted)]">{c.descripcion}</p> : null}
                  </td>
                  <td className="px-4 py-3">{c.medio}</td>
                  <td className="px-4 py-3">{ESTADOS_COBRO[c.estado] ?? c.estado}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{formatMinorArs(c.montoMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
