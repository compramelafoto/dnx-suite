import { DNX_AUTH_CTA } from "../types";
import { DnxAuthNotice } from "./DnxAuthNotice";

export function DnxSessionExpiredNotice({
  message = DNX_AUTH_CTA.sessionExpired,
  loginHref = "/login",
}: {
  message?: string;
  loginHref?: string;
}) {
  return (
    <div data-dnx-auth-slot="session-expired" style={{ display: "grid", gap: "1rem" }}>
      <DnxAuthNotice tone="warning" message={message} />
      <a href={loginHref} style={{ color: "var(--auth-primary)", textAlign: "center" }}>
        {DNX_AUTH_CTA.login}
      </a>
    </div>
  );
}
