"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "../../utils";
import { getIcon, type IconName } from "../../icons";

type IconSize = "sm" | "md" | "lg";

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

interface IconPropsWithName {
  name: IconName;
  icon?: never;
  size?: IconSize;
  className?: string;
  strokeWidth?: number;
}

interface IconPropsWithIcon {
  name?: never;
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  strokeWidth?: number;
}

type IconProps = IconPropsWithName | IconPropsWithIcon;

export function Icon({
  name,
  icon: LucideIconComponent,
  size = "md",
  className,
  strokeWidth = 2,
}: IconProps) {
  const resolved = name ? getIcon(name) : LucideIconComponent;
  if (!resolved) return null;

  const px = sizeMap[size];
  const LucideIcon = resolved;

  return (
    <LucideIcon
      size={px}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      style={{ width: px, height: px, color: "currentColor" }}
      aria-hidden
    />
  );
}
