import Link from "next/link";
import { dateRangeText } from "@repo/muestras";
import { misParticipaciones } from "@/lib/expositores/consultas";
import { resumenDeObras } from "@/lib/expositores/mapear";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Donde expongo" };

export default async function DondeExpongo() {
  const usuario = await requireUsuario("/panel/expositor");
  const filas = await misParticipaciones(usuario);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Donde expongo</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">Las muestras a las que te sumaste con el enlace de quien organiza, y tus obras en cada una.</p>
      </header>
      {filas.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Todavía no expusiste por acá. Cuando una organización te mande su enlace, vas a ver la muestra en esta lista.
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {filas.map((e) => {
            const cambios = e.works.filter((w) => w.status === "CHANGES_REQUESTED").length;
            return (
              <li key={e.id} className="space-y-2 border-b border-[var(--mf-line)] py-6">
                {e.status === "ACTIVE" ? (
                  <Link href={`/panel/expositor/${e.id}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{e.activity.title}</Link>
                ) : (
                  <span className="mf-titulo text-xl">{e.activity.title}</span>
                )}
                <p className="text-sm text-[var(--mf-muted)]">
                  {dateRangeText(e.activity.startsAt, e.activity.endsAt)}
                  {e.activity.isCancelled ? " · Cancelada" : ""}
                </p>
                {e.status === "ACTIVE" ? (
                  <p className="text-[15px]">{resumenDeObras(e.works)}.</p>
                ) : (
                  <p className="text-[15px]">Quien organiza te sacó de esta muestra.</p>
                )}
                {e.status === "ACTIVE" && cambios ? (
                  <p className="text-[15px] text-[var(--mf-alerta)]">
                    {cambios === 1 ? "Te pidieron cambios en una obra." : `Te pidieron cambios en ${cambios} obras.`}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
