import Link from "next/link";
import { prisma } from "@repo/db";
import { requireMembersManageContext } from "@/lib/members/access";
import { listarEnvios } from "@/lib/box-mensual/store";
import { direccionLegible, etiquetaBox } from "@/lib/box-mensual/secuencia";
import { fechaBox } from "@/lib/box-mensual/formato";
import { EnvioAcciones } from "@/components/box-mensual/envio-acciones";

export const dynamic = "force-dynamic";

/** Sin filtro se muestran los últimos envíos; con una persona elegida, todo su recorrido. */
const LIMITE = 300;

/** «Enviadas»: el historial de envíos, con filtro por persona y la opción de marcar «entregada». */
export default async function BoxEnviadasPage({
  searchParams,
}: {
  searchParams: Promise<{ socio?: string }>;
}) {
  const { workspace } = await requireMembersManageContext();
  const { socio } = await searchParams;
  const memberId = socio?.trim() || undefined;

  const [envios, conEnvios] = await Promise.all([
    listarEnvios(workspace.id, { memberId, take: memberId ? undefined : LIMITE }),
    prisma.member.findMany({
      where: { workspaceId: workspace.id, boxShipments: { some: {} } },
      select: { id: true, memberNumber: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="socio">
            Persona socia
          </label>
          <select id="socio" name="socio" defaultValue={memberId ?? ""} className="fo-input min-w-64">
            <option value="">Todas</option>
            {conEnvios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.lastName}, {m.firstName} · N° {m.memberNumber}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
          Filtrar
        </button>
        {memberId ? (
          <Link href="/members/box/enviadas" className="fo-btn fo-btn-ghost text-sm">
            Ver todas
          </Link>
        ) : null}
      </form>

      {envios.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no se envió ninguna caja.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
          <table className="w-full text-sm text-left min-w-[900px]">
            <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Enviada</th>
                <th className="px-4 py-3 font-semibold">Persona socia</th>
                <th className="px-4 py-3 font-semibold">Caja</th>
                <th className="px-4 py-3 font-semibold">Dirección</th>
                <th className="px-4 py-3 font-semibold">Seguimiento</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
              {envios.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--fo-muted)]">{fechaBox(e.shippedAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/members/${e.member.id}`} className="text-[var(--fo-text)] hover:underline">
                      {e.member.lastName}, {e.member.firstName}
                    </Link>
                    <p className="text-xs text-[var(--fo-muted-soft)]">N° {e.member.memberNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--fo-text)]">
                    {etiquetaBox({ number: e.boxNumber, name: e.boxName })}
                  </td>
                  <td className="px-4 py-3 max-w-xs text-[var(--fo-muted)]">{direccionLegible(e)}</td>
                  <td className="px-4 py-3 text-[var(--fo-muted)]">
                    {[e.carrier, e.trackingCode].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "ENTREGADA" ? (
                      <span className="text-[var(--fo-success)] font-medium">
                        Entregada{e.deliveredAt ? ` · ${fechaBox(e.deliveredAt)}` : ""}
                      </span>
                    ) : (
                      <div className="space-y-2">
                        <span className="font-medium text-[var(--fo-text)]">Enviada</span>
                        <EnvioAcciones shipmentId={e.id} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!memberId && envios.length === LIMITE ? (
        <p className="text-xs text-[var(--fo-muted)]">{`Se muestran los últimos ${LIMITE} envíos. Filtrá por persona para ver su recorrido completo.`}</p>
      ) : null}
    </div>
  );
}
