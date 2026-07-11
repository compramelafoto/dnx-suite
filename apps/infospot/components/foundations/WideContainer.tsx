import { cx } from "./cx";
import type { FoundationBoxProps } from "./SiteContainer";

/** Contenedor multimedia amplio (max 960px). */
export function WideContainer({
  children,
  className,
  as: Tag = "div",
}: FoundationBoxProps) {
  return <Tag className={cx("is-container-wide", className)}>{children}</Tag>;
}
