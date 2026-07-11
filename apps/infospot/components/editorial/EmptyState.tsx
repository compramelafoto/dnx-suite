import Link from "next/link";
import { cx } from "@/components/foundations/cx";

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: Props) {
  return (
    <div
      className={cx(
        "rounded-[var(--is-radius-lg)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)] px-6 py-12 text-center md:px-10 md:py-16",
        className,
      )}
    >
      <h2 className="is-h2 text-xl">{title}</h2>
      {description ? (
        <p className="is-body mx-auto mt-3 max-w-md">{description}</p>
      ) : null}
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="is-btn is-btn-primary mt-8 min-h-11">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
