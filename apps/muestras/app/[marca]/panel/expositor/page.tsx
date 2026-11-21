import Link from "next/link";
import { dateRangeText } from "@repo/muestras";
import { misObrasDeConcursos } from "@/lib/concursos/consultas";
import { misParticipaciones } from "@/lib/expositores/consultas";
import { resumenDeObras } from "@/lib/expositores/mapear";
import { muestrasParaVender } from "@/lib/ventas/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dónde expongo" };

export default async function DondeExpongo() {
  const usuario = await requireUsuario("/panel/expositor");
  const [filas, concursos, paraVender] = await Promise.all([misParticipaciones(usuario), misObrasDeConcursos(usuario), muestrasParaVender(usuario)]);
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Dónde expongo</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">Las muestras a las que te sumaste con el enlace de quien organiza, y tus obras en cada una.</p>
      </header>
      {paraVender.length ? (
        <section className="space-y-3">
          <h2 className="mf-titulo text-2xl">Vender tus obras</h2>
          <p className="text-[15px] text-[var(--mf-muted)]">Muestras con venta donde tenés obras marcadas para vender: elegí formatos y precios, subí el original y tu firma.</p>
          <ul className="border-t border-[var(--mf-line)]">
            {paraVender.map((v) => (
              <li key={v.activityId} className="space-y-1 border-b border-[var(--mf-line)] py-4">
                <Link href={`/panel/expositor/ventas/${v.activityId}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{v.title}</Link>
                <p className={v.faltan ? "text-[15px] text-[var(--mf-alerta)]" : "text-[15px]"}>
                  {v.faltan === 0 ? "Todo listo para vender." : v.faltan === 1 ? "Falta una cosa para vender." : `Faltan ${v.faltan} cosas para vender.`}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {filas.length === 0 && concursos.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Todavía no expusiste por acá. Cuando una organización te mande su enlace, o arme una muestra con un concurso donde participaste, la vas a ver en esta lista.
        </p>
      ) : filas.length === 0 ? null : (
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
      {concursos.length ? (
        <section className="space-y-3">
          <h2 className="mf-titulo text-2xl">Tus obras de concursos</h2>
          <p className="text-[15px] text-[var(--mf-muted)]">Muestras armadas con obras tuyas de un concurso de FotoRank. Vos decidís si se exponen y si se pueden vender.</p>
          <ul className="border-t border-[var(--mf-line)]">
            {concursos.map((c) => (
              <li key={c.id} className="space-y-2 border-b border-[var(--mf-line)] py-6">
                <Link href={`/panel/expositor/concurso/${c.id}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{c.muestra.title}</Link>
                <p className="text-sm text-[var(--mf-muted)]">
                  {c.concurso} · {c.organizacion}
                </p>
                <p className="text-sm text-[var(--mf-muted)]">
                  {dateRangeText(c.muestra.startsAt, c.muestra.endsAt)} ·{" "}
                  {c.muestra.isVirtualOnly ? "Sólo online" : c.muestra.venueName ? [c.muestra.venueName, c.muestra.city].filter(Boolean).join(", ") : "Sede a confirmar"}
                  {c.muestra.isCancelled ? " · Cancelada" : ""}
                </p>
                {c.pendientes ? (
                  <p className="text-[15px] text-[var(--mf-alerta)]">
                    {c.pendientes === 1 ? "Una obra espera tu respuesta." : `${c.pendientes} obras esperan tu respuesta.`}
                  </p>
                ) : (
                  <p className="text-[15px]">{c.obras === 1 ? "Una obra tuya." : `${c.obras} obras tuyas.`}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
