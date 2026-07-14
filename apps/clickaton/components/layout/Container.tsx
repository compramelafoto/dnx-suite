import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const widthClass = {
  narrow: "max-w-[var(--ck-content-readable)]",
  standard: "max-w-[var(--ck-content-standard)]",
  wide: "max-w-[var(--ck-content-wide)]",
} as const;

type ContainerProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  width?: keyof typeof widthClass;
  children: ReactNode;
};

export function Container({
  as: Tag = "div",
  width = "standard",
  className,
  children,
  ...props
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        "mx-auto w-full px-[var(--ck-gutter)]",
        widthClass[width],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
