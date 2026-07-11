import { Cluster } from "@/components/foundations";
import { cx } from "@/components/foundations/cx";
import { formatDateEs } from "@/lib/dates";

type Props = {
  date?: Date | string | null;
  readingHint?: string | null;
  location?: string | null;
  className?: string;
};

export function ArticleMetadata({
  date,
  readingHint,
  location,
  className,
}: Props) {
  if (!date && !readingHint && !location) return null;

  return (
    <Cluster gap={2} className={cx("is-metadata", className)} as="p">
      {date ? (
        <time dateTime={new Date(date).toISOString()}>{formatDateEs(date)}</time>
      ) : null}
      {date && location ? <span aria-hidden>·</span> : null}
      {location ? <span>{location}</span> : null}
      {(date || location) && readingHint ? <span aria-hidden>·</span> : null}
      {readingHint ? <span>{readingHint}</span> : null}
    </Cluster>
  );
}
