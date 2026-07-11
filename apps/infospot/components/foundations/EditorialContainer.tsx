import { cx } from "./cx";
import type { FoundationBoxProps } from "./SiteContainer";

/** Contenedor de grillas editoriales / listados (max 1320px). */
export function EditorialContainer({
  children,
  className,
  as: Tag = "div",
}: FoundationBoxProps) {
  return (
    <Tag className={cx("is-container-editorial", className)}>{children}</Tag>
  );
}
