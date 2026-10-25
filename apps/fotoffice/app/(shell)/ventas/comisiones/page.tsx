import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { formatMinorArs } from "@/lib/membership/money";
import { requireSalesStaff } from "@/lib/sales/access";
import { inicioDelMesEnArgentina, resumir, type Comision } from "@/lib/comisiones/calculo";
import { comisionesDelWorkspace, equipoDelWorkspace, esDuenoOAdmin, leerReglas } from "@/lib/comisiones/servidor";
import { AjustesComisiones } from "./ajustes-comisiones";

export const dynamic = "force-dynamic";

const pesos = (minor: number) => formatMinorArs(minor).replace(/,00$/, "");
const fecha = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit" });

function Resumen({ comisiones }: { comisiones: Comision[] }) {
  const r = resumir(comisiones, inicioDelMesEnArgentina(new Date()));
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="fo-card p-4">
        <p className="fo-helper">Ganado este mes</p>
        <p className="text-2xl font-semibold tabular-nums text-[var(--fo-success)]">{pesos(r.mesMinor)}</p>
      </div>
      <div className="fo-card p-4">
        <p className="fo-helper">A cobrar (pedidos con saldo)</p>
        <p className="text-2xl font-semibold tabular-nums">{pesos(r.aCobrarMinor)}</p>
      </div>
      <div className="fo-card p-4">
        <p className="fo-helper">Ganado desde el inicio</p>
        <p className="text-2xl font-semibold tabular-nums">{pesos(r.totalMinor)}</p>
      </div>
    </div>
  );
}

function Detalle({ comisiones, nombres }: { comisiones: Comision[]; nombres: Map<number, string> | null }) {
  if (comisiones.length === 0) return <p className="fo-helper">Todavía no hay ventas de fotolibros con comisión.</p>;
  return (
    <div className="fo-card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-[var(--fo-muted)]">
          <tr>
            <th className="px-4 py-2 font-semibold">Vendido</th>
            {nombres ? <th className="px-4 py-2 font-semibold">Vendedora</th> : null}
            <th className="px-4 py-2 font-semibold">Qué</th>
            <th className="px-4 py-2 font-semibold">Precio</th>
            <th className="px-4 py-2 font-semibold">Comisión</th>
            <th className="px-4 py-2 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {comisiones.map((c) => (
            <tr key={`${c.origen}-${c.id}`} className="border-t border-[var(--fo-border)]">
              <td className="px-4 py-2 tabular-nums">{fecha(c.vendidaEl)}</td>
              {nombres ? <td className="px-4 py-2">{nombres.get(c.vendedorId) ?? "—"}</td> : null}
              <td className="px-4 py-2">
                {c.origen === "PEDIDO" ? (
                  <Link href={`/pedidos/${encodeURIComponent(c.id)}`} className="hover:underline">
                    Pedido {c.numero}
                  </Link>
                ) : (
                  <span>Venta {c.numero}</span>
                )}
                <span className="block text-xs text-[var(--fo-muted)]">{c.descripcion}</span>
              </td>
              <td className="px-4 py-2 tabular-nums">{pesos(c.baseMinor)}</td>
              <td className="px-4 py-2 font-semibold tabular-nums">{pesos(c.comisionMinor)}</td>
              <td className="px-4 py-2">
                {c.ganadaEl ? (
                  <span className="text-[var(--fo-success)]">Ganada el {fecha(c.ganadaEl)}</span>
                ) : (
                  <span className="text-[var(--fo-muted)]">Se gana al cobrar el saldo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Comisiones de venta: cada vendedora ve lo suyo (ganado este mes, a cobrar, desde el inicio);
 * el dueño ve a todas y elige quién cobra comisión y cuánto.
 */
export default async function ComisionesPage() {
  const { user, workspace } = await requireSalesStaff();
  const dueno = await esDuenoOAdmin(user.id, workspace.id);

  if (!dueno) {
    const { reglas, comisiones } = await comisionesDelWorkspace(workspace.id, user.id);
    const regla = reglas[0];
    return (
      <div className="space-y-6">
        <PageHeader title="Mis comisiones" description="Lo que ganás por vender fotolibros. Se suma cuando la venta queda cobrada entera." />
        {regla ? (
          <>
            <p className="text-sm">
              Ganás el <span className="font-semibold text-[var(--fo-success)]">{String(regla.porcentaje).replace(".", ",")} %</span> del precio de venta de cada fotolibro y su caja.
            </p>
            <Resumen comisiones={comisiones} />
            <Detalle comisiones={comisiones} nombres={null} />
          </>
        ) : (
          <p className="fo-helper">No tenés comisión de venta asignada.</p>
        )}
      </div>
    );
  }

  const [equipo, reglas, { comisiones }] = await Promise.all([equipoDelWorkspace(workspace.id), leerReglas(workspace.id), comisionesDelWorkspace(workspace.id)]);
  const nombres = new Map(equipo.map((m) => [m.userId, m.nombre]));
  return (
    <div className="space-y-6">
      <PageHeader title="Comisiones de venta" description="Lo que gana el equipo por vender fotolibros (tapa flexible, tapa rígida y caja). Se gana cuando la venta queda cobrada entera." />
      <AjustesComisiones
        equipo={equipo.filter((m) => m.userId !== user.id).map((m) => ({ userId: m.userId, nombre: m.nombre, email: m.email }))}
        reglas={reglas.map((r) => ({ userId: r.userId, porcentaje: r.porcentaje, activa: r.activa }))}
      />
      <Resumen comisiones={comisiones} />
      <Detalle comisiones={comisiones} nombres={nombres} />
    </div>
  );
}
