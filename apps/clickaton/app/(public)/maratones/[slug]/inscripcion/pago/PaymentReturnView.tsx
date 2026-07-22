import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { routes, marathonPath } from "@/config/navigation";
import { getRegistrationCheckoutResultAction } from "@/lib/checkout/actions/checkout";
import { formatHoldExpiry, formatPublicPrice } from "@/lib/public-registration/ui/format";

type Props = {
  slug: string;
  registrationId: string;
  accessToken: string;
  variant: "exito" | "pendiente" | "error";
  errCode?: string;
};

export async function PaymentReturnView({
  slug,
  registrationId,
  accessToken,
  variant,
  errCode,
}: Props) {
  const result = await getRegistrationCheckoutResultAction(
    registrationId,
    accessToken,
    slug,
  );

  if (!result.ok || !result.data) {
    const code = result.code ?? "";
    const hint =
      code === "TOKEN_EXPIRED"
        ? "El enlace de acceso expiró. El retorno del navegador no confirma el pago; el sistema lo verifica por separado."
        : code === "TOKEN_INVALID" || !accessToken
          ? "No pudimos validar el enlace de acceso (token ausente, truncado o firmado con otro secreto). El retorno del navegador no confirma el pago."
          : (result.message ?? "Enlace inválido o expirado.");
    return (
      <Section>
        <Container className="space-y-6 py-12">
          <h1 className="ck-display-md">No pudimos verificar el pago</h1>
          <p className="text-ck-text-secondary" role="alert">
            {hint}
          </p>
          <Button href={marathonPath(slug)} variant="secondary">
            Volver a la maratón
          </Button>
        </Container>
      </Section>
    );
  }

  const s = result.data;
  const title =
    variant === "exito"
      ? s.displayAsApproved
        ? "Pago confirmado"
        : "Estamos verificando tu pago"
      : variant === "pendiente"
        ? "Pago pendiente"
        : "No se completó el pago";

  const summaryHref = `/maratones/${slug}/inscripcion/resumen/${registrationId}?t=${encodeURIComponent(accessToken)}`;

  return (
    <Section>
      <Container className="space-y-8 py-10 md:py-14">
        <SimpleBreadcrumb
          items={[
            { label: "Inicio", href: routes.home },
            { label: "Maratones", href: routes.marathons },
            { label: "Maratón", href: marathonPath(slug) },
            { label: "Pago" },
          ]}
        />
        <header className="space-y-3">
          <p className="ck-label text-ck-yellow">Retorno de checkout</p>
          <h1 className="ck-display-md">{title}</h1>
          <p className="max-w-2xl text-ck-text-secondary" role="status">
            {s.message}
            {variant === "exito" && !s.displayAsApproved
              ? " El retorno del navegador no confirma el pago por sí solo; esperamos la verificación del sistema."
              : ""}
            {errCode ? ` Código: ${errCode}.` : ""}
          </p>
        </header>

        <dl className="grid gap-4 rounded-[var(--ck-radius-card)] border border-ck-border p-6 text-sm md:grid-cols-2">
          <div>
            <dt className="text-ck-text-secondary">Inscripción</dt>
            <dd className="font-mono">{s.publicCode ?? s.registrationId.slice(0, 12)}</dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Estado inscripción / cobro</dt>
            <dd>
              {s.registrationStatus.replaceAll("_", " ")} ·{" "}
              {s.paymentStatus.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Importe</dt>
            <dd>{formatPublicPrice(s.amountMinor, s.currency)}</dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Orden (enmascarada)</dt>
            <dd className="font-mono text-xs">
              {s.paymentOrderId
                ? `${s.paymentOrderId.slice(0, 6)}…${s.paymentOrderId.slice(-4)}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Proveedor</dt>
            <dd>{s.provider ?? "DNX Payments"}</dd>
          </div>
          <div>
            <dt className="text-ck-text-secondary">Reserva</dt>
            <dd>{formatHoldExpiry(s.holdExpiresAt)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-3">
          <Button href={summaryHref} variant="primary">
            Ver resumen
          </Button>
          <Button href={marathonPath(slug)} variant="secondary">
            Volver a la maratón
          </Button>
        </div>
      </Container>
    </Section>
  );
}
