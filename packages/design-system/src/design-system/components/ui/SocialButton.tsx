"use client";

import type { AnchorHTMLAttributes } from "react";
import { radius } from "../../tokens";
import { Icon } from "./Icon";

const BRAND_COLORS: Record<string, string> = {
  mercadopago: "#009ee3",
  facebook: "#1877f2",
  instagram: "#e4405f",
  twitter: "#1da1f2",
  tiktok: "#000000",
};

interface SocialButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> {
  variant: "mercadopago" | "facebook" | "instagram" | "twitter" | "tiktok";
  "aria-label"?: string;
}

const iconMap = {
  mercadopago: "payment",
  facebook: "facebook",
  instagram: "instagram",
  twitter: "twitter",
  tiktok: "tiktok",
} as const;

export function SocialButton({ variant, "aria-label": ariaLabel, href, ...props }: SocialButtonProps) {
  const color = BRAND_COLORS[variant] ?? "#737373";
  const iconName = iconMap[variant];

  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? variant}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
        borderRadius: radius.button,
        background: color,
        color: "#fff",
        transition: "opacity 0.15s ease",
      }}
      {...props}
    >
      <Icon name={iconName} size="md" />
    </a>
  );
}
