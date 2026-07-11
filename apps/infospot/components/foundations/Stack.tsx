import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx } from "./cx";

export type SpaceToken =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 8
  | 10
  | 12
  | 16
  | 20
  | 24
  | 30
  | 40;

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  gap?: SpaceToken;
  style?: CSSProperties;
};

const gapClass: Record<SpaceToken, string> = {
  1: "is-stack-1",
  2: "is-stack-2",
  3: "is-stack-3",
  4: "is-stack-4",
  5: "is-stack-5",
  6: "is-stack-6",
  8: "is-stack-8",
  10: "is-stack-10",
  12: "is-stack-12",
  16: "gap-[var(--is-space-16)]",
  20: "gap-[var(--is-space-20)]",
  24: "gap-[var(--is-space-24)]",
  30: "gap-[var(--is-space-30)]",
  40: "gap-[var(--is-space-40)]",
};

/** Stack vertical con gap tokenizado. */
export function Stack({
  children,
  className,
  as: Tag = "div",
  gap = 4,
  style,
}: Props) {
  return (
    <Tag className={cx("is-stack", gapClass[gap], className)} style={style}>
      {children}
    </Tag>
  );
}
