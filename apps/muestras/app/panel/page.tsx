import Link from "next/link";
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, countByStatus } from "@repo/muestras";
import { contarParaRevisar, listarMias } from "@/lib/actividades/consultas";
import { puede } from "@/lib/equipo/permisos";
import { misObrasConCambios, misParticipaciones, pendientesPorMuestra } from "@/lib/expositores/consultas";
import { buscarPerfilPropio } from "@/lib/perfiles/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi panel" };

const accion = "inline-flex h-11 items-center border border-[var(--mf-ink)] px-5 text-[15px] transition-colors hover:bg-[var(--mf-ink)] hover:text-white";

export default async function InicioPanel() {
  const usuario = await requireUsuario("/panel");
  const [mias, perfil, paraRevisar] = await Promise.all([
    listarMias(usuario),
    buscarPerfilPropio(usuario.id),
    usuario.esSuperAdmin ? contarParaRevisar() : Promise.resolve(0),
  ]);
  const cuenta = countByStatus(mias);
  const [pendientes, participaciones, conCambios] = await Promise.all([
    pendientesPorMuestra(mias.filter((m) => m.type === "MUESTRA" && puede(usuario, "exhibitors", m.rol)).map((m) => m.id)),
    misParticipaciones(usuario),
    misObrasConCambios(usuario),
  ]);
  const obrasParaRevisar = [...pendientes.values()].reduce((a, b) => a + b, 0);
  const expongo = participaciones.filter((p) => p.status === "ACTIVE").length;
  const nombre = usuario.name?.split(" ")[0];

  return (
    <main className="space-y-14">
      <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Hola{nombre ? `, ${nombre}` : ""}</h1>

      {paraRevisar > 0 ? (
        <p className="border-l-2 border-[var(--mf-spot)] pl-4 text-lg">
          <Link href="/panel/revision" className="underline underline-offset-[6px]">
            {paraRevisar === 1 ? "Hay 1 propuesta para revisar" : `Hay ${paraRevisar} propuestas para revisar`}
          </Link>
        </p>
      ) : null}

      {obrasParaRevisar > 0 ? (
        <p className="border-l-2 border-[var(--mf-spot)] pl-4 text-lg">
          <Link href="/panel/muestras" className="underline underline-offset-[6px]">
            {obrasParaRevisar === 1 ? "Hay 1 obra de expositores para revisar" : `Hay ${obrasParaRevisar} obras de expositores para revisar`}
          </Link>
        </p>
      ) : null}

      {expongo > 0 ? (
        <section aria-labelledby="t-expongo" className="space-y-2">
          <h2 id="t-expongo" className="text-sm text-[var(--mf-muted)]">Donde expongo</h2>
          <p className="text-lg">
            {expongo === 1 ? "Exponés en 1 muestra." : `Exponés en ${expongo} muestras.`}
            {conCambios > 0 ? ` ${conCambios === 1 ? "Te pidieron cambios en 1 obra." : `Te pidieron cambios en ${conCambios} obras.`}` : ""}
          </p>
          <Link href="/panel/expositor" className="inline-block underline underline-offset-[6px]">Ir a mis obras</Link>
        </section>
      ) : null}

      <section aria-labelledby="t-mias">
        <h2 id="t-mias" className="text-sm text-[var(--mf-muted)]">Tus muestras y actividades</h2>
        {mias.length === 0 ? (
          <p className="mt-3 text-lg">Todavía no propusiste ninguna ni formás parte de un equipo.</p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 border-t border-[var(--mf-line)] sm:grid-cols-5">
              {REVIEW_STATUSES.map((st) => (
                <div key={st} className="border-b border-[var(--mf-line)] py-4 pr-4">
                  <dt className="text-[13px] text-[var(--mf-muted)]">{REVIEW_STATUS_LABELS[st]}</dt>
                  <dd className="mf-titulo mt-1 text-3xl tabular-nums">{cuenta[st]}</dd>
                </div>
              ))}
            </dl>
            <Link href="/panel/muestras" className="mt-4 inline-block underline underline-offset-[6px]">Ver todas</Link>
          </>
        )}
      </section>

      <section aria-labelledby="t-accesos" className="space-y-4">
        <h2 id="t-accesos" className="text-sm text-[var(--mf-muted)]">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/panel/proponer" className={accion}>Proponer una muestra</Link>
          <Link href="/panel/perfil" className={accion}>{perfil ? "Editar mi perfil" : "Crear mi perfil de fotógrafo"}</Link>
          {cuenta.APPROVED > 0 ? <Link href="/panel/montaje" className={accion}>Fichas de sala con QR</Link> : null}
        </div>
      </section>
    </main>
  );
}
