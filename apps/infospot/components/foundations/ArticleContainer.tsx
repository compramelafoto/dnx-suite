import { cx } from "./cx";
import type { FoundationBoxProps } from "./SiteContainer";

/** Columna de lectura editorial (max 760px). */
export function ArticleContainer({
  children,
  className,
  as: Tag = "div",
}: FoundationBoxProps) {
  return (
    <Tag className={cx("is-container-article", className)}>{children}</Tag>
  );
}
