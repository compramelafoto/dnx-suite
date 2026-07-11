import { cx } from "./cx";

type Props = {
  className?: string;
  strong?: boolean;
};

/** Separador hairline entre bloques editoriales. */
export function SectionDivider({ className, strong = false }: Props) {
  return (
    <hr
      className={cx(strong ? "is-divider-strong" : "is-divider", className)}
    />
  );
}
