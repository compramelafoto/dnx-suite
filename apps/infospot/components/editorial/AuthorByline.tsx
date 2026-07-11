import { cx } from "@/components/foundations/cx";

type Props = {
  name: string;
  className?: string;
};

export function AuthorByline({ name, className }: Props) {
  return (
    <p className={cx("text-sm font-medium text-[var(--is-text)]", className)}>
      <span className="is-metadata mr-1.5 font-normal">Por</span>
      {name}
    </p>
  );
}
