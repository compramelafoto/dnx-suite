import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
};

/** Subtítulo / descripción de sección. */
export function SectionSubtitle({
  children,
  className,
  as: Tag = "p",
}: Props) {
  return <Tag className={cx("is-subtitle", "mt-3", className)}>{children}</Tag>;
}
