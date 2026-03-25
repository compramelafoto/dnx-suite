"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { Card as DSCard } from "@repo/design-system";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Superficie y sombra del `@repo/design-system` (tokens + compositionSpacing). */
export default function Card({ className, children, ...props }: CardProps) {
  return (
    <DSCard className={cn(className)} {...props}>
      {children}
    </DSCard>
  );
}
