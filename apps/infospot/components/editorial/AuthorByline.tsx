import Link from "next/link";
import { cx } from "@/components/foundations/cx";

type Props = {
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
  href?: string | null;
  className?: string;
};

export function AuthorByline({ name, avatarUrl, bio, href, className }: Props) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  const identity = (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar público autor
        <img
          src={avatarUrl}
          alt=""
          width={36}
          height={36}
          className="size-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--is-border)]"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xs font-semibold text-[var(--is-muted)] ring-1 ring-[var(--is-border)]"
        >
          {initial}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--is-text)]">
          <span className="is-metadata mr-1.5 font-normal">Por</span>
          {href ? (
            <Link href={href} className="hover:text-[var(--is-accent)] hover:underline">
              {name}
            </Link>
          ) : (
            name
          )}
        </span>
        {bio ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--is-muted)] line-clamp-2">
            {bio}
          </span>
        ) : null}
      </span>
    </span>
  );

  return <div className={cx("min-w-0", className)}>{identity}</div>;
}
