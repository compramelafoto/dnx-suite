import type { Metadata } from "next";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/navigation";
import { normalizeRouteToken, resolveDiplomaVerification } from "@/lib/diplomas/diploma-verification";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  // noIndex: cada diploma es de una persona puntual: no puede aparecer en un buscador.
  return buildPageMetadata({
    title: "Verificación de diploma",
    description: "Comprobá si un diploma de participación de Clickatón es auténtico.",
    path: `/diplomas/verificar/${token}`,
    noIndex: true,
  });
}

export default async function DiplomaVerifyPage({ params }: PageProps) {
  const { token: raw } = await params;
  const token = normalizeRouteToken(raw);
  const result = await resolveDiplomaVerification(token);

  return (
    <>
      <SimpleBreadcrumb current="Verificar diploma" />
      <Section>
        <Container width="narrow">
          <p className="ck-overline text-ck-yellow">Clickatón</p>
          <h1 className="ck-display-md mt-2 text-ck-text">Verificación de diploma</h1>
          <p className="ck-body-md mt-4 text-ck-text-secondary">
            Clickatón es una maratón fotográfica: un evento donde la gente sale a sacar
            fotos con consignas y tiempo limitado. Al terminar, cada participante recibe
            un diploma de participación con un código QR. Esta página confirma si el
            diploma que escaneaste es auténtico.
          </p>

          {result.state === "VALID" ? (
            <Card variant="outlined" className="mt-8 space-y-6 border-ck-yellow/35">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success">Diploma válido</Badge>
              </div>
              <p className="ck-body-sm text-ck-text-secondary">
                Este diploma fue emitido por Clickatón y está vigente.
              </p>
              <dl className="grid gap-4 border-t border-ck-border pt-6 sm:grid-cols-2">
                <div>
                  <dt className="ck-caption text-ck-text-muted">Participante</dt>
                  <dd className="mt-1 font-medium text-ck-text">{result.participantName}</dd>
                </div>
                <div>
                  <dt className="ck-caption text-ck-text-muted">Edición</dt>
                  <dd className="mt-1 text-ck-text">{result.editionName}</dd>
                </div>
                <div>
                  <dt className="ck-caption text-ck-text-muted">Fecha del evento</dt>
                  <dd className="mt-1 text-ck-text">{result.eventDateLabel}</dd>
                </div>
                <div>
                  <dt className="ck-caption text-ck-text-muted">Fecha de emisión</dt>
                  <dd className="mt-1 text-ck-text">{result.issuedAtLabel}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="ck-caption text-ck-text-muted">Código del diploma</dt>
                  <dd className="mt-1 font-mono text-sm text-ck-text">{result.diplomaCode}</dd>
                </div>
              </dl>
            </Card>
          ) : null}

          {result.state === "REVOKED" ? (
            <Card variant="outlined" className="mt-8 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="danger">Diploma revocado</Badge>
              </div>
              <p className="ck-body-sm text-ck-text-secondary">
                Este diploma fue revocado por la organización de Clickatón y ya no es
                válido como comprobante de participación.
              </p>
              <dl className="grid gap-4 border-t border-ck-border pt-6 sm:grid-cols-2">
                <div>
                  <dt className="ck-caption text-ck-text-muted">Participante</dt>
                  <dd className="mt-1 font-medium text-ck-text">{result.participantName}</dd>
                </div>
                <div>
                  <dt className="ck-caption text-ck-text-muted">Código del diploma</dt>
                  <dd className="mt-1 font-mono text-sm text-ck-text">{result.diplomaCode}</dd>
                </div>
              </dl>
            </Card>
          ) : null}

          {result.state === "NOT_FOUND" ? (
            <Card variant="outlined" className="mt-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="warning">No encontramos este diploma</Badge>
              </div>
              <p className="ck-body-sm text-ck-text-secondary">
                No hay ningún diploma registrado con este código. Puede que el enlace esté
                incompleto o mal escrito. Si escaneaste un QR impreso, probá de nuevo o
                consultá con quien te lo entregó.
              </p>
            </Card>
          ) : null}

          <div className="mt-10">
            <Button href={routes.home} variant="outline">
              Volver al inicio
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
