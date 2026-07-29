import { verifyEmailWithToken, DNX_AUTH_MESSAGES } from "@repo/auth";
import { VerifyEmailClient } from "./VerifyEmailClient";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function VerificarEmailPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = sp.token?.trim() ?? "";

  let message: string = DNX_AUTH_MESSAGES.verifyInvalidToken;
  let ok = false;

  if (token) {
    try {
      await verifyEmailWithToken({ rawToken: token });
      message = DNX_AUTH_MESSAGES.verifySuccess;
      ok = true;
    } catch (err) {
      message =
        err instanceof Error ? err.message : DNX_AUTH_MESSAGES.verifyInvalidToken;
    }
  }

  return <VerifyEmailClient status={ok ? "success" : "error"} message={message} />;
}
