import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { buildVerification, recheck } from "@/lib/raffles/verification";
import { fechaHora } from "@/lib/raffles/labels";

export const dynamic = "force-dynamic";

/**
 * La pantalla que sostiene todo el módulo.
 *
 * Regla de escritura: **ningún párrafo de acá puede necesitar saber qué es un hash para
 * entenderse.** La palabra "huella" alcanza; "SHA-256" va como dato, no como explicación. Si
 * el socio no entiende esta página, la garantía existe en el código y no en su cabeza, que es
 * lo mismo que no existir.
 */
export default async function VerificacionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, RAFFLES_MODULE_KEY))) {
    redirect("/portal");
  }

  const { id } = await params;
  const sorteo = await prisma.raffle.findFirst({
    where: { id, workspaceId: context.workspace.id },
    select: {
      id: true,
      title: true,
      status: true,
      entrantsHash: true,
      entrantsCount: true,
      drandChainHash: true,
      drandRound: true,
      drandRandomness: true,
      drandSignature: true,
      sealedAt: true,
      drawnAt: true,
      entries: {
        orderBy: { position: "asc" },
        select: { position: true, memberNumberSnapshot: true, fullNameSnapshot: true },
      },
      prizes: {
        orderBy: { order: "asc" },
        select: { order: true, title: true, award: { select: { winnerPosition: true } } },
      },
    },
  });
  if (!sorteo) notFound();

  const datos = buildVerification(sorteo);
  if (!datos) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{sorteo.title}</h1>
        <p className="fo-card p-6 text-sm">
          Este sorteo todavía no se resolvió, así que no hay nada que verificar. Cuando se
          haga, acá van a estar todos los datos para comprobarlo.
        </p>
        <Link href="/portal/sorteos" className="text-sm underline">
          Volver a sorteos
        </Link>
      </div>
    );
  }

  const control = recheck(datos);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">Cómo se sabe que este sorteo no está arreglado</h1>
        <p className="text-sm leading-relaxed">
          El ganador salió de dos datos que nadie pudo elegir a la vez: la{" "}
          <strong>lista de participantes</strong>, que se cerró y se publicó antes; y un{" "}
          <strong>número al azar</strong> que producen varias organizaciones en conjunto y que
          apareció después. Con esos dos datos, la cuenta que da el ganador es siempre la
          misma, y la puede hacer cualquiera.
        </p>
        <p className="text-sm text-[var(--fo-muted)]">{datos.title}</p>
      </header>

      {/* 1. Los cuatro datos */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Los datos</h2>

        <div className="fo-card space-y-2 p-6">
          <p className="font-medium">La huella de la lista de participantes</p>
          <p className="text-sm text-[var(--fo-muted)]">
            Se publicó el {fechaHora(datos.sealedAt)}, cuando el número todavía no existía. Una
            huella es un resumen que cambia entero si se toca cualquier cosa de la lista: sirve
            para demostrar después que la lista es la misma, sin haberla podido cambiar.
          </p>
          <p className="break-all font-mono text-xs">{datos.entrantsHash}</p>
        </div>

        <div className="fo-card space-y-2 p-6">
          <p className="font-medium">De dónde salió el número</p>
          <p className="text-sm text-[var(--fo-muted)]">
            De <strong>drand</strong>, un servicio público que mantienen en conjunto varias
            organizaciones —entre ellas Cloudflare y la Escuela Politécnica de Lausana—.
            Producen un número nuevo cada tres segundos, y está hecho de manera que{" "}
            <strong>ninguna de ellas pueda generarlo sola, ni predecirlo, ni torcerlo</strong>.
            Cuál de todos esos números íbamos a usar quedó decidido al anunciar el sorteo: el
            número {datos.round} de la serie.
          </p>
          <p className="break-all font-mono text-xs">Serie {datos.chainHash}</p>
        </div>

        <div className="fo-card space-y-2 p-6">
          <p className="font-medium">El número</p>
          <p className="text-sm text-[var(--fo-muted)]">
            drand lo publicó el {fechaHora(datos.roundPublishedAt)}. El sorteo se resolvió el{" "}
            {fechaHora(datos.drawnAt)}.
          </p>
          <p className="break-all font-mono text-xs">{datos.randomness}</p>
          <p className="text-sm">
            <a
              href={datos.drandUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Verlo en el sitio de drand, sin pasar por FotOffice
            </a>
          </p>
        </div>

        {datos.signature ? (
          <div className="fo-card space-y-2 p-6">
            <p className="font-medium">La firma con que drand lo publicó</p>
            <p className="break-all font-mono text-xs">{datos.signature}</p>
          </div>
        ) : null}
      </section>

      {/* 2. El resultado */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">El resultado</h2>
        <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
          {datos.prizes.map((p) => (
            <li key={p.order} className="px-4 py-3 text-sm">
              <span className="font-medium">{p.title}</span> — salió la posición{" "}
              {p.winnerPosition}: {p.winnerLabel}
            </li>
          ))}
        </ul>
      </section>

      {/* 3. La cuenta */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">La cuenta, paso a paso</h2>
        <ol className="fo-card list-decimal space-y-3 p-6 pl-10 text-sm leading-relaxed">
          <li>
            Se juntan tres cosas: la huella de la lista, el número de drand y el orden del
            premio (1 para el primero, 2 para el segundo…).
          </li>
          <li>
            Con esas tres cosas se arma un resumen —el mismo tipo de huella— y de ahí se toman
            los primeros ocho bytes, que dan un número enorme.
          </li>
          <li>
            Ese número se divide por la cantidad de participantes y se mira el resto. Ese resto
            es la posición que gana. Si el número cae en un tramo que dejaría a los primeros de
            la lista con una chance apenas mayor, se descarta y se vuelve a empezar sumando 1
            al final: así ninguna posición tiene ventaja sobre otra.
          </li>
          <li>
            Quien ganó sale de la bolsa, y se repite para el premio siguiente. Por eso nadie se
            lleva dos premios del mismo sorteo.
          </li>
        </ol>
        <details className="fo-card p-6 text-sm">
          <summary className="cursor-pointer font-medium">
            La cuenta escrita para quien quiera rehacerla en otro lenguaje
          </summary>
          <pre className="mt-4 overflow-x-auto rounded bg-[var(--fo-code-bg)] p-4 text-xs">
{`huella = SHA256("fotoffice-raffle-v1\\n" + idDelSorteo + "\\n" +
                participantes.map(p => p.posicion + ":" + p.numeroDeSocio).join("\\n"))

para cada premio, con la bolsa de los que todavía no ganaron:
  i = 0
  repetir:
    resumen = SHA256("fotoffice-raffle-draw-v1\\n" + huella + "\\n" + tanda + "\\n" +
                     numero + "\\n" + ordenDelPremio + "\\n" + i)
    x      = primeros 8 bytes del resumen, como entero de 64 bits sin signo
    limite = piso(2^64 / bolsa.length) * bolsa.length
    si x < limite:  gana bolsa[x mod bolsa.length];  terminar
    i = i + 1`}
          </pre>
          <p className="mt-3 text-[var(--fo-muted)]">
            El id de este sorteo es <span className="font-mono">{datos.raffleId}</span>.
          </p>
        </details>
      </section>

      {/* 4. El control automático */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">La cuenta rehecha acá mismo</h2>
        {control.ok ? (
          <p className="fo-alert-success p-4 text-sm">
            Rehicimos la cuenta con los datos de esta página y da exactamente el mismo
            resultado. Que lo diga esta pantalla no reemplaza a que lo compruebe otra persona
            —el control y el sorteo salen del mismo lugar—, pero muestra qué tiene que dar.
          </p>
        ) : (
          <div className="fo-alert-error space-y-2 p-4 text-sm">
            <p className="font-medium">La cuenta no da. Avisale a la Secretaría.</p>
            <ul className="list-disc space-y-1 pl-5">
              {control.mismatches.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 5. La lista completa */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Los {datos.entrants.length} participantes, en el orden que entró en la cuenta
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Esta es la lista congelada el {fechaHora(datos.sealedAt)}. Es con estos datos —la
          posición y el número de socio— que se calcula la huella de arriba.
        </p>
        <div className="fo-card max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--fo-surface)] text-left text-[var(--fo-muted)]">
              <tr className="border-b border-[var(--fo-border)]">
                <th className="px-4 py-2 font-medium">Posición</th>
                <th className="px-4 py-2 font-medium">Socio</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
              </tr>
            </thead>
            <tbody>
              {datos.entrants.map((e) => (
                <tr key={e.position} className="border-b border-[var(--fo-border-muted)] last:border-0">
                  <td className="px-4 py-2 tabular-nums">{e.position}</td>
                  <td className="px-4 py-2 tabular-nums">{e.memberNumber}</td>
                  <td className="px-4 py-2">{e.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm">
        <Link href="/portal/sorteos" className="underline">
          Volver a sorteos
        </Link>
      </p>
    </div>
  );
}
