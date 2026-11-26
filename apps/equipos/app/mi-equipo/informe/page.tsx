import Link from "next/link";
import { prisma } from "@repo/db";
import { requireLevel } from "@/lib/guards";
import { KIND_LABELS, listItems, STATUS_LABELS } from "@/lib/inventario/equipos";
import { fechaAr, fechaInput } from "@/lib/inventario/formato";
import { listOwnReports } from "@/lib/informe/snapshot";
import { formatMoney } from "@/lib/informe/formato";
import { generarInforme, guardarPoliza } from "./actions";

export const dynamic = "force-dynamic";

const NO_ASEGURABLES = ["STOLEN", "LOST", "SOLD"];

export default async function InformePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const user = await requireLevel("identidad", "/mi-equipo/informe");
  const { ok, error } = await searchParams;
  const [equipos, informes, ajustes] = await Promise.all([
    listItems(user.id),
    listOwnReports(user.id),
    prisma.gearOwnerSettings.findUnique({
      where: { userId: user.id },
      select: { policyRenewalDate: true },
    }),
  ]);

  const elegibles = equipos.filter(
    (e) =>
      !NO_ASEGURABLES.includes(e.status) && e.declaredValueArs != null && e.declaredValueUsd != null,
  );
  const excluidos = equipos.filter((e) => !elegibles.includes(e));

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <p>
        <Link href="/mi-equipo">← Mi equipo</Link>
      </p>
      <h1>Informe para aseguradoras</h1>
      {ok ? <p role="status">{ok}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <section>
        <h2>Generar un informe nuevo</h2>
        <p>
          Elegí los equipos que querés incluir. El informe queda fijo con los datos de hoy y trae un
          código QR para que la aseguradora lo valide. Sólo se pueden incluir equipos con valor en
          pesos y en dólares cargados.
        </p>
        {elegibles.length === 0 ? (
          <p>
            Todavía no tenés equipos para incluir. Cargá el valor en pesos y en dólares desde la ficha
            de cada equipo.
          </p>
        ) : (
          <form action={generarInforme}>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {elegibles.map((e) => (
                <li key={e.id} style={{ marginBottom: 6 }}>
                  <label>
                    <input type="checkbox" name="itemId" value={e.id} defaultChecked />{" "}
                    <strong>
                      {e.make} {e.model}
                    </strong>{" "}
                    ({KIND_LABELS[e.kind]}) · $ {formatMoney(e.declaredValueArs!)} / USD{" "}
                    {formatMoney(e.declaredValueUsd!)}
                  </label>
                </li>
              ))}
            </ul>
            <button type="submit">Generar informe</button>
          </form>
        )}
        {excluidos.length > 0 ? (
          <details style={{ marginTop: 12 }}>
            <summary>Equipos que no se pueden incluir ({excluidos.length})</summary>
            <ul>
              {excluidos.map((e) => (
                <li key={e.id}>
                  <Link href={`/mi-equipo/${e.id}`}>
                    {e.make} {e.model}
                  </Link>{" "}
                  —{" "}
                  {NO_ASEGURABLES.includes(e.status)
                    ? `figura como ${STATUS_LABELS[e.status].toLowerCase()}`
                    : "falta el valor en pesos o en dólares"}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section>
        <h2>Informes emitidos</h2>
        {informes.length === 0 ? (
          <p>Todavía no emitiste ningún informe.</p>
        ) : (
          <ul>
            {informes.map((r) => (
              <li key={r.id} style={{ marginBottom: 6 }}>
                {fechaAr(r.createdAt)} · $ {formatMoney(r.totalArs)} / USD {formatMoney(r.totalUsd)} ·{" "}
                <a href={`/api/informe/${r.code}/pdf`}>Descargar PDF</a> ·{" "}
                <Link href={`/informe/${r.code}`}>Ver validación</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Renovación de la póliza</h2>
        <p>
          Guardá la fecha en que vence o se renueva tu póliza y te avisamos por correo 30 días antes.
        </p>
        <form action={guardarPoliza}>
          <label>
            Fecha de renovación{" "}
            <input
              type="date"
              name="policyRenewalDate"
              defaultValue={fechaInput(ajustes?.policyRenewalDate ?? null)}
            />
          </label>{" "}
          <button type="submit">Guardar</button>
        </form>
      </section>
    </main>
  );
}
