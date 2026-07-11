import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

export type FoundationBoxProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

type ContainerProps = FoundationBoxProps;

/** Contenedor general del sitio (max 1320px). */
export function SiteContainer({
  children,
  className,
  as: Tag = "div",
}: ContainerProps) {
  return <Tag className={cx("is-container-site", className)}>{children}</Tag>;
}
