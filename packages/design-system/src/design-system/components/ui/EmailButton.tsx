"use client";

import type { AnchorHTMLAttributes } from "react";
import { radius } from "../../tokens";
import { Icon } from "./Icon";

const EMAIL_RED = "#ea4335";

interface EmailButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> {
  to: string;
  subject?: string;
  body?: string;
  "aria-label"?: string;
}

export function EmailButton({ to, subject = "", body = "", "aria-label": ariaLabel, ...props }: EmailButtonProps) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const qs = params.toString();
  const href = `mailto:${to}${qs ? "?" + qs : ""}`;

  return (
    <a
      href={href}
      aria-label={ariaLabel ?? "Enviar email"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: radius.button,
        background: EMAIL_RED,
        color: "#fff",
        transition: "opacity 0.15s ease",
      }}
      {...props}
    >
      <Icon name="email" size="md" />
    </a>
  );
}
