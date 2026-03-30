import Link from "next/link";
import { notFound } from "next/navigation";
import { getDiplomaVerificationPayload } from "../../../lib/fotorank/diplomas/verificationPayload";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function DiplomaVerifyPage({ params }: PageProps) {
  const { token: raw } = await params;
  const token = raw ? decodeURIComponent(raw) : "";
  if (!token) notFound();

  const payload = await getDiplomaVerificationPayload(token);

  return (
    <div className="min-h-[100dvh] bg-fr-bg text-fr-primary">
      <div className="fr-container mx-auto max-w-lg px-8 py-16 md:py-24">
        <div className="mb-10 text-center">
          <p className="fr-eyebrow mb-3">FotoRank</p>
          <h1 className="font-sans text-2xl font-semibold tracking-tight md:text-3xl">Verificación de diploma</h1>
          <p className="mt-4 text-sm leading-relaxed text-fr-muted">
            Comprobación pública del documento emitido por el organizador.
          </p>
        </div>

        <article className="fr-recuadro rounded-xl border border-fr-border bg-fr-card shadow-lg">
          {payload.state === "INVALID_TOKEN" ? (
            <StatusBlock variant="danger" title="Token no válido" description="El enlace está incompleto o corrupto." />
          ) : null}

          {payload.state === "NOT_FOUND" ? (
            <StatusBlock variant="neutral" title="No encontrado" description="No hay un diploma registrado con este código." />
          ) : null}

          {payload.state === "VALID" ? (
            <>
              <StatusBlock variant="success" title="Diploma válido" description="El documento figura como emitido correctamente." />
              <dl className="mt-10 space-y-6 border-t border-fr-border pt-10">
                <Field label="Concurso" value={payload.contestTitle} />
                <Field label="Organizador" value={payload.organizerName} />
                <Field label="Destinatario" value={payload.recipientName} />
                {payload.categoryLabel ? <Field label="Categoría" value={payload.categoryLabel} /> : null}
                {payload.prizeLabel ? <Field label="Premio / tipo" value={payload.prizeLabel} /> : null}
                <Field label="Fecha de emisión" value={payload.issuedAtLabel} />
                <Field label="Código del diploma" value={payload.diplomaCode} mono />
              </dl>
            </>
          ) : null}

          {payload.state === "REVOKED" ? (
            <>
              <StatusBlock variant="warning" title="Revocado" description="Este diploma fue revocado por el organizador." />
              <dl className="mt-10 space-y-6 border-t border-fr-border pt-10">
                <Field label="Concurso" value={payload.contestTitle} />
                <Field label="Organizador" value={payload.organizerName} />
                <Field label="Destinatario" value={payload.recipientName} />
                <Field label="Código" value={payload.diplomaCode} mono />
                <Field label="Última emisión registrada" value={payload.issuedAtLabel} />
              </dl>
            </>
          ) : null}

          {payload.state === "REPLACED" ? (
            <>
              <StatusBlock
                variant="warning"
                title="Reemplazado"
                description="Este diploma fue sustituido por una nueva emisión. La validez corresponde al documento vigente."
              />
              <dl className="mt-10 space-y-6 border-t border-fr-border pt-10">
                <Field label="Concurso" value={payload.contestTitle} />
                <Field label="Organizador" value={payload.organizerName} />
                <Field label="Destinatario" value={payload.recipientName} />
                <Field label="Código anterior" value={payload.diplomaCode} mono />
              </dl>
              {payload.newVerificationUrl ? (
                <div className="mt-10 border-t border-fr-border pt-10">
                  <p className="text-sm font-medium text-fr-primary">Diploma vigente</p>
                  <p className="mt-2 text-sm text-fr-muted">
                    Nuevo código: <span className="font-mono text-gold">{payload.newDiplomaCode}</span>
                  </p>
                  <Link
                    href={payload.newVerificationUrl}
                    className="fr-btn fr-btn-primary mt-6 inline-flex w-full justify-center sm:w-auto"
                  >
                    Ver diploma vigente
                  </Link>
                </div>
              ) : (
                <p className="mt-10 text-sm text-fr-muted">
                  El reemplazo aún no está disponible públicamente. Contactá al organizador.
                </p>
              )}
            </>
          ) : null}

          {payload.state === "FAILED" ? (
            <>
              <StatusBlock
                variant="danger"
                title="Emisión incompleta"
                description="Este registro existe pero el archivo final no se generó correctamente."
              />
              <dl className="mt-10 space-y-6 border-t border-fr-border pt-10">
                <Field label="Concurso" value={payload.contestTitle} />
                <Field label="Organizador" value={payload.organizerName} />
                <Field label="Destinatario" value={payload.recipientName} />
                <Field label="Código" value={payload.diplomaCode} mono />
              </dl>
            </>
          ) : null}
        </article>

        <p className="mt-12 text-center text-xs text-fr-muted">
          <Link href="/" className="underline decoration-fr-border underline-offset-4 hover:text-gold">
            Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}

function StatusBlock(props: {
  variant: "success" | "warning" | "danger" | "neutral";
  title: string;
  description: string;
}) {
  const ring =
    props.variant === "success"
      ? "border-emerald-500/40 bg-emerald-500/10"
      : props.variant === "warning"
        ? "border-amber-500/40 bg-amber-500/10"
        : props.variant === "danger"
          ? "border-red-500/40 bg-red-500/10"
          : "border-fr-border bg-fr-bg-elevated";
  const titleColor =
    props.variant === "success"
      ? "text-emerald-200"
      : props.variant === "warning"
        ? "text-amber-100"
        : props.variant === "danger"
          ? "text-red-200"
          : "text-fr-primary";
  return (
    <div className={`rounded-lg border px-5 py-5 ${ring}`}>
      <h2 className={`font-sans text-lg font-semibold tracking-tight ${titleColor}`}>{props.title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-fr-muted">{props.description}</p>
    </div>
  );
}

function Field(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-fr-muted">{props.label}</dt>
      <dd
        className={`mt-2 text-base leading-snug text-fr-primary ${props.mono ? "font-mono text-sm text-gold" : ""}`}
      >
        {props.value}
      </dd>
    </div>
  );
}
