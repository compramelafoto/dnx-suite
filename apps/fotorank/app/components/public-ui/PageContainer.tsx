import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  children: ReactNode;
  className?: string;
  width?: "default" | "narrow" | "readable";
  as?: "div" | "section" | "main";
};

export function PageContainer({ children, className, width = "default", as: Tag = "div" }: Props) {
  return (
    <Tag
      className={cn(
        "fr-public-container",
        width === "narrow" && "fr-public-container--narrow",
        width === "readable" && "fr-public-container--readable",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
