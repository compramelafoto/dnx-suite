import Link from "next/link";
import { SectionSubtitle, SectionTitle } from "@/components/foundations";
import { cx } from "@/components/foundations/cx";

type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  actionLabel?: string;
  actionHref?: string;
  /** @deprecated Preferir actionHref */
  href?: string;
  /** @deprecated Preferir actionLabel */
  linkLabel?: string;
  className?: string;
  /** id del heading (accesibilidad / landmarks) */
  id?: string;
};

export function SectionHeader({
  title,
  description,
  eyebrow,
  actionLabel,
  actionHref,
  href,
  linkLabel = "Ver más",
  className,
  id,
}: Props) {
  const resolvedHref = actionHref ?? href;
  const resolvedLabel = actionLabel ?? linkLabel;

  return (
    <div
      className={cx(
        "mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? <p className="is-eyebrow mb-3">{eyebrow}</p> : null}
        <SectionTitle id={id} className="text-2xl md:text-3xl">
          {title}
        </SectionTitle>
        {description ? <SectionSubtitle>{description}</SectionSubtitle> : null}
      </div>
      {resolvedHref ? (
        <Link
          href={resolvedHref}
          className="is-btn is-btn-ghost min-h-11 shrink-0 self-start sm:self-auto"
        >
          {resolvedLabel}
        </Link>
      ) : null}
    </div>
  );
}
