import "@repo/auth-ui/tokens.css";
import { DNX_AUTH_MESSAGES, verifyEmailWithToken } from "@repo/auth";
import {
  DnxAuthHeader,
  DnxAuthShell,
  DnxVerificationState,
  equiposAuthBrand,
} from "@repo/auth-ui";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function VerificarEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const raw = token?.trim() ?? "";
  let message: string = DNX_AUTH_MESSAGES.verifyInvalidToken;
  let ok = false;

  if (raw) {
    try {
      await verifyEmailWithToken({ rawToken: raw });
      message = DNX_AUTH_MESSAGES.verifySuccess;
      ok = true;
    } catch (err) {
      message = err instanceof Error ? err.message : DNX_AUTH_MESSAGES.verifyInvalidToken;
    }
  }

  return (
    <DnxAuthShell brand={equiposAuthBrand}>
      <DnxAuthHeader
        logo={equiposAuthBrand.logo}
        title="Verificación de correo"
        description="Confirmamos tu correo para activar tu Cuenta DNX."
      />
      <DnxVerificationState
        status={ok ? "success" : "error"}
        message={message}
        loginHref={ok ? "/cuenta/verificacion" : "/login"}
      />
    </DnxAuthShell>
  );
}
