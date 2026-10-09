import Link from "next/link";
import { CALL_STATUS_LABELS, isCallStatus } from "@repo/muestras";
import { listarMisCuradurias } from "@/lib/curaduria/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Curaduría" };

export default async function Curaduria() {
  const usuario = await requireUsuario("/panel/curaduria");
  const mias = await listarMisCuradurias(usuario.id);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Curaduría</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Las convocatorias donde sos parte del equipo curatorial. Ayudás a elegir las obras que se van a exponer en una muestra
          presencial: las ves sin el nombre de su autor, en un orden propio, y las puntuás de 1 a 5.
        </p>
      </header>
      {mias.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Todavía no te invitaron a curar. La invitación llega por mail, con un enlace.</p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {mias.map((m) => {
            const abierta = m.call.status === "CURATING" || m.call.status === "DONE";
            return (
              <li key={m.curatorId} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--mf-line)] py-4">
                <span>
                  {abierta ? (
                    <Link href={`/panel/curaduria/${m.call.id}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{m.call.title}</Link>
                  ) : (
                    <span className="mf-titulo text-xl">{m.call.title}</span>
                  )}
                  <span className="block text-[13px] text-[var(--mf-muted)]">
                    {abierta ? `Puntuaste ${m.puntuadas} de ${m.total}` : "La curaduría empieza cuando quien organiza la abra. Te vamos a ver acá."}
                  </span>
                </span>
                <span className="text-sm">{isCallStatus(m.call.status) ? CALL_STATUS_LABELS[m.call.status] : m.call.status}</span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
