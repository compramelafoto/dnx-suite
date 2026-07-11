import type { CSSProperties, ElementType, ReactNode } from "react";
import { cx } from "./cx";
import type { SpaceToken } from "./Stack";

type Align = "start" | "center" | "end" | "baseline" | "stretch";
type Justify = "start" | "center" | "end" | "between" | "around";

type Props = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  gap?: SpaceToken;
  align?: Align;
  justify?: Justify;
  nowrap?: boolean;
  style?: CSSProperties;
};

const gapClass: Record<SpaceToken, string> = {
  1: "is-cluster-1",
  2: "is-cluster-2",
  3: "is-cluster-3",
  4: "is-cluster-4",
  5: "is-cluster-5",
  6: "is-cluster-6",
  8: "is-cluster-8",
  10: "gap-[var(--is-space-10)]",
  12: "gap-[var(--is-space-12)]",
  16: "gap-[var(--is-space-16)]",
  20: "gap-[var(--is-space-20)]",
  24: "gap-[var(--is-space-24)]",
  30: "gap-[var(--is-space-30)]",
  40: "gap-[var(--is-space-40)]",
};

const alignClass: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  baseline: "items-baseline",
  stretch: "items-stretch",
};

const justifyClass: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

/** Cluster horizontal con wrap (metadata, acciones, chips). */
export function Cluster({
  children,
  className,
  as: Tag = "div",
  gap = 3,
  align = "center",
  justify = "start",
  nowrap = false,
  style,
}: Props) {
  return (
    <Tag
      className={cx(
        "is-cluster",
        gapClass[gap],
        alignClass[align],
        justifyClass[justify],
        nowrap && "flex-nowrap",
        className,
      )}
      style={style}
    >
      {children}
    </Tag>
  );
}
