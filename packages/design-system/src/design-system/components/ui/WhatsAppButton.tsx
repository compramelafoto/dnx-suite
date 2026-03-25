"use client";

import type { AnchorHTMLAttributes } from "react";
import { radius } from "../../tokens";
import { Icon } from "./Icon";

const WHATSAPP_GREEN = "#25D366";

interface WhatsAppButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> {
  phone: string;
  message?: string;
  "aria-label"?: string;
}

export function WhatsAppButton({ phone, message = "", "aria-label": ariaLabel, className, style, ...props }: WhatsAppButtonProps) {
  const normalized = phone.replace(/\D/g, "");
  const href = `https://wa.me/${normalized}${message ? "?text=" + encodeURIComponent(message) : ""}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? "Contactar por WhatsApp"}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: radius.button,
        background: WHATSAPP_GREEN,
        color: "#fff",
        transition: "opacity 0.15s ease",
        ...style,
      }}
      {...props}
    >
      <Icon name="whatsapp" size="md" />
    </a>
  );
}
