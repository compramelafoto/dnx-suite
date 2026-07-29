import { DnxAuthNotice } from "./DnxAuthNotice";
import { DNX_AUTH_CTA } from "../types";

export function DnxVerificationState({
  status,
  message,
  loginHref = "/login",
}: {
  status: "pending" | "success" | "error";
  message: string;
  loginHref?: string;
}) {
  const tone = status === "success" ? "success" : status === "error" ? "warning" : "info";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
      <DnxAuthNotice tone={tone} message={message} />
      <a
        href={loginHref}
        style={{
          textAlign: "center",
          color: "var(--auth-primary)",
          fontFamily: "var(--auth-font)",
          fontSize: "0.9375rem",
        }}
      >
        {DNX_AUTH_CTA.login}
      </a>
    </div>
  );
}
