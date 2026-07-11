import { cx } from "@/components/foundations/cx";

type Props = {
  caption?: string | null;
  credit?: string | null;
  copyrightText?: string | null;
  className?: string;
};

export function ImageCaption({
  caption,
  credit,
  copyrightText,
  className,
}: Props) {
  if (!caption && !credit && !copyrightText) return null;

  return (
    <figcaption className={cx("is-caption mt-3 space-y-1", className)}>
      {caption ? <p>{caption}</p> : null}
      {credit ? (
        <p className="font-medium text-[var(--is-text-secondary)]">{credit}</p>
      ) : null}
      {copyrightText ? <p className="text-xs">{copyrightText}</p> : null}
    </figcaption>
  );
}
