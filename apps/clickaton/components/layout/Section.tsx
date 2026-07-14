import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const toneClass = {
  default: "bg-ck-bg text-ck-text",
  muted: "bg-ck-bg-alt text-ck-text",
  yellow: "bg-ck-yellow text-ck-black",
  dark: "bg-ck-black text-ck-white",
  accent: "bg-ck-accent-soft text-ck-text",
} as const;

type SectionProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  tone?: keyof typeof toneClass;
  grain?: boolean;
  children: ReactNode;
};

export function Section({
  as: Tag = "section",
  tone = "default",
  grain = false,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <Tag
      className={cn(
        "py-[var(--ck-section-spacing)]",
        toneClass[tone],
        grain && "ck-grain",
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
