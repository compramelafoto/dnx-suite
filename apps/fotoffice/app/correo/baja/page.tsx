import type { Metadata } from "next";
import { MAILING_TOPIC_PHRASE } from "@/lib/mailing/constants";
import { institutionName, listOptOutTopics, parseTopic, readUnsubscribeToken } from "@/lib/mailing/opt-out";
import { updateSubscriptionAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tus correos", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ t?: string; tema?: string; listo?: string; error?: string }> };

/**
 * Página del enlace «Darme de baja» de los correos a socios.
 *
 * Abrirla NO da de baja: muchos antivirus abren los enlaces de los correos para revisarlos, y eso
 * daría de baja a gente que no lo pidió. La persona elige con un botón.
 */
export default async function BajaDeCorreosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const payload = readUnsubscribeToken(sp.t);

  if (!payload) {
    return (
      <Marco>
        <h1 className="text-xl font-semibold text-[var(--fo-text)]">El enlace no es válido</h1>
        <p className="mt-2 text-sm text-[var(--fo-muted)]">
          Puede que esté incompleto. Abrí de nuevo el enlace «Darme de baja» desde el correo que recibiste, o
          respondé ese correo pidiendo la baja.
        </p>
      </Marco>
    );
  }

  const [nombre, bajas] = await Promise.all([
    institutionName(payload.workspaceId),
    listOptOutTopics(payload.workspaceId, payload.email),
  ]);
  const institucion = nombre ?? "la institución";
  const tema = parseTopic(sp.tema);
  const sinNada = bajas.includes("all");
  const sinTema = tema !== "all" && bajas.includes(tema);
  const token = sp.t ?? "";

  return (
    <Marco>
      <p className="text-sm font-medium text-[var(--fo-muted)]">{institucion}</p>
      <h1 className="mt-1 text-xl font-semibold text-[var(--fo-text)]">Tus correos</h1>
      <p className="mt-2 text-sm text-[var(--fo-muted)]">
        Casilla: <strong className="text-[var(--fo-text)]">{payload.email}</strong>
      </p>

      {sp.listo === "baja" ? (
        <p className="fo-alert-success mt-4 text-sm">Listo. Ya no vas a recibir esos correos.</p>
      ) : null}
      {sp.listo === "alta" ? (
        <p className="fo-alert-success mt-4 text-sm">Listo. Vas a volver a recibir los correos de {institucion}.</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {sinNada ? (
          <Fila
            token={token}
            texto={`No recibís ningún correo de novedades de ${institucion}.`}
            topic="all"
            op="resubscribe"
            boton="Volver a recibirlos"
          />
        ) : (
          <>
            {tema !== "all" ? (
              sinTema ? (
                <Fila
                  token={token}
                  texto={`No recibís ${MAILING_TOPIC_PHRASE[tema]}.`}
                  topic={tema}
                  op="resubscribe"
                  boton="Volver a recibirlos"
                />
              ) : (
                <Fila
                  token={token}
                  texto={`Dejar de recibir sólo ${MAILING_TOPIC_PHRASE[tema]}.`}
                  topic={tema}
                  op="unsubscribe"
                  boton="Darme de baja"
                />
              )
            ) : null}
            <Fila
              token={token}
              texto={`Dejar de recibir todos los correos de novedades de ${institucion}.`}
              topic="all"
              op="unsubscribe"
              boton="Darme de baja de todo"
            />
          </>
        )}
      </div>

      <p className="mt-6 text-xs text-[var(--fo-muted)]">
        Los avisos de tu cuenta —cuotas, reservas, inscripciones— siguen llegando: son parte de ser socio.
      </p>
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[var(--fo-bg)] px-4 py-12">
      <div className="fo-card w-full max-w-md p-6">{children}</div>
    </main>
  );
}

function Fila(props: { token: string; texto: string; topic: string; op: "unsubscribe" | "resubscribe"; boton: string }) {
  return (
    <form action={updateSubscriptionAction} className="flex flex-col gap-2 rounded-lg border border-[var(--fo-border)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <input type="hidden" name="t" value={props.token} />
      <input type="hidden" name="topic" value={props.topic} />
      <input type="hidden" name="op" value={props.op} />
      <span className="text-sm text-[var(--fo-text)]">{props.texto}</span>
      <button type="submit" className={`fo-btn ${props.op === "unsubscribe" ? "fo-btn-secondary" : "fo-btn-primary"} shrink-0`}>
        {props.boton}
      </button>
    </form>
  );
}
