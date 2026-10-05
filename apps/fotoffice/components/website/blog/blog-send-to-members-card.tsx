import Link from "next/link";
import { prisma } from "@repo/db";
import { getMailingSettings } from "@/lib/mailing/settings";
import { blogPostDedupeKey, loadAudience } from "@/lib/mailing/campaigns";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/mailing/constants";
import { sendBlogTestAction, sendBlogToMembersAction } from "@/app/actions/mailing";

const fecha = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(v);

/**
 * «Enviar a socios por email», en el editor de un artículo. Componente de servidor.
 *
 * Un artículo se manda una sola vez. Con los envíos apagados (Comunicación → Correo) sólo ofrece la
 * prueba, que le llega a quien la aprieta.
 */
export async function BlogSendToMembersCard(props: {
  workspaceId: string;
  postId: number;
  published: boolean;
  okMessage?: string;
  errorMessage?: string;
}) {
  const mensajes = (
    <>
      {props.errorMessage ? (
        <p className="fo-alert-error p-3 text-sm" role="alert">
          {props.errorMessage}
        </p>
      ) : null}
      {props.okMessage ? <p className="fo-alert-success p-3 text-sm">{props.okMessage}</p> : null}
    </>
  );

  if (!props.published) {
    return (
      <Tarjeta>
        {mensajes}
        <p className="text-sm text-[var(--fo-muted)]">Cuando el artículo esté publicado vas a poder mandárselo a los socios.</p>
      </Tarjeta>
    );
  }

  let datos: {
    enviado: { createdAt: Date; sentCount: number; recipientsTotal: number; status: string } | null;
    destinatarios: number;
    bulkEnabled: boolean;
  };
  try {
    const [enviado, audiencia, settings] = await Promise.all([
      prisma.fotofficeEmailCampaign.findUnique({
        where: { dedupeKey: blogPostDedupeKey(props.workspaceId, props.postId) },
        select: { createdAt: true, sentCount: true, recipientsTotal: true, status: true },
      }),
      loadAudience(props.workspaceId, "blog"),
      getMailingSettings(props.workspaceId),
    ]);
    datos = { enviado, destinatarios: audiencia.recipients.length, bulkEnabled: settings.bulkEnabled };
  } catch {
    return (
      <Tarjeta>
        <p className="text-sm text-[var(--fo-muted)]">El envío a socios todavía no está disponible.</p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      {mensajes}
      {datos.enviado ? (
        <p className="text-sm text-[var(--fo-text-secondary)]">
          Se envió el {fecha(datos.enviado.createdAt)}: salió a {datos.enviado.sentCount} de {datos.enviado.recipientsTotal}{" "}
          socios ({(CAMPAIGN_STATUS_LABEL[datos.enviado.status] ?? datos.enviado.status).toLowerCase()}). Un artículo se manda
          una sola vez.
        </p>
      ) : (
        <p className="text-sm text-[var(--fo-text-secondary)]">
          Le llega a {datos.destinatarios} socios activos con correo, con la portada, el título, la bajada y un botón para
          leerlo en el sitio. Antes, mandate una prueba para ver cómo queda.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <form action={sendBlogTestAction}>
          <input type="hidden" name="postId" value={props.postId} />
          <button type="submit" className="fo-btn fo-btn-secondary">
            Enviarme una prueba
          </button>
        </form>

        {!datos.enviado && datos.bulkEnabled && datos.destinatarios > 0 ? (
          <form action={sendBlogToMembersAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="hidden" name="postId" value={props.postId} />
            <label className="flex items-center gap-2 text-sm text-[var(--fo-text)]">
              <input type="checkbox" name="confirmar" value="1" required />
              Revisé la prueba
            </label>
            <button type="submit" className="fo-btn fo-btn-primary">
              Enviar a {datos.destinatarios} socios
            </button>
          </form>
        ) : null}
      </div>

      {!datos.enviado && !datos.bulkEnabled ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Los envíos a socios están apagados. Se encienden en{" "}
          <Link href="/comunicacion/correo" className="underline">
            Comunicación → Correo
          </Link>
          .
        </p>
      ) : null}
    </Tarjeta>
  );
}

function Tarjeta({ children }: { children: React.ReactNode }) {
  return (
    <section className="fo-card space-y-3 p-5">
      <h2 className="text-base font-semibold text-[var(--fo-text)]">Enviar a socios por email</h2>
      {children}
    </section>
  );
}
