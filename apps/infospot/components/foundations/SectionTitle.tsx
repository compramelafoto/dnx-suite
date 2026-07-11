import type { ElementType, ReactNode } from "react";
import { cx } from "./cx";

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  id?: string;
};

/** Título de sección (H2 por defecto). */
export function SectionTitle({
  children,
  className,
  as: Tag = "h2",
  id,
}: Props) {
  return (
    <Tag id={id} className={cx("is-h2", className)}>
      {children}
    </Tag>
  );
}
