import type { LucideIcon } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type CommonProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "section" | "main" | "header" | "footer" | "nav" | "article";
} & Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "id">;

/** Ancho general ~1180–1280px + padding lateral responsive. */
export function PageContainer({ children, className, id, as: Tag = "div", ...rest }: CommonProps) {
  return (
    <Tag id={id} className={cx("fr-contest-page", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Contenedor de página / grids (máx. ~80rem / 1280px). */
export function ContentContainer({ children, className, id, as: Tag = "div", ...rest }: CommonProps) {
  return (
    <Tag id={id} className={cx("fr-contest-container", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Ancho de lectura ~680–760px. */
export function ReadingContainer({ children, className, id, as: Tag = "div", ...rest }: CommonProps) {
  return (
    <Tag id={id} className={cx("fr-contest-reading", className)} {...rest}>
      {children}
    </Tag>
  );
}

type PageSectionProps = CommonProps & {
  tone?: "default" | "muted" | "emphasis";
  flush?: boolean;
};

export function PageSection({
  children,
  className,
  id,
  as: Tag = "section",
  tone = "default",
  flush = false,
  ...rest
}: PageSectionProps) {
  return (
    <Tag
      id={id}
      className={cx(
        "fr-contest-section",
        tone === "muted" && "fr-contest-section--muted",
        tone === "emphasis" && "fr-contest-section--emphasis",
        flush && "fr-contest-section--flush",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type StackProps = CommonProps & {
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
};

export function Stack({ children, className, id, as: Tag = "div", gap = "md", ...rest }: StackProps) {
  return (
    <Tag id={id} className={cx("fr-contest-stack", `fr-contest-stack--${gap}`, className)} {...rest}>
      {children}
    </Tag>
  );
}

type ClusterProps = CommonProps & {
  gap?: "xs" | "sm" | "md" | "lg";
  align?: "start" | "center" | "end" | "baseline";
  justify?: "start" | "center" | "between" | "end";
};

export function Cluster({
  children,
  className,
  id,
  as: Tag = "div",
  gap = "sm",
  align = "center",
  justify = "start",
  ...rest
}: ClusterProps) {
  return (
    <Tag
      id={id}
      className={cx(
        "fr-contest-cluster",
        `fr-contest-cluster--gap-${gap}`,
        `fr-contest-cluster--align-${align}`,
        `fr-contest-cluster--justify-${justify}`,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type SurfaceProps = CommonProps & {
  elevated?: boolean;
  padding?: "sm" | "md" | "lg";
  interactive?: boolean;
};

export function Surface({
  children,
  className,
  id,
  as: Tag = "div",
  elevated = false,
  padding = "md",
  interactive = false,
  ...rest
}: SurfaceProps) {
  return (
    <Tag
      id={id}
      className={cx(
        "fr-contest-surface",
        `fr-contest-surface--pad-${padding}`,
        elevated && "fr-contest-surface--elevated",
        interactive && "fr-contest-surface--interactive",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  level?: 2 | 3;
  /** Ícono sutil Lucide a la izquierda del título. */
  icon?: LucideIcon;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  level = 2,
  icon: Icon,
}: SectionHeadingProps) {
  const TitleTag = level === 3 ? "h3" : "h2";
  return (
    <div className={cx("fr-contest-section-heading", className)}>
      {eyebrow ? <p className="fr-type-eyebrow">{eyebrow}</p> : null}
      <div className="fr-contest-section-heading__title-row">
        {Icon ? (
          <span className="fr-contest-section-heading__icon" aria-hidden>
            <Icon width={22} height={22} strokeWidth={1.75} />
          </span>
        ) : null}
        <TitleTag className={level === 3 ? "fr-type-h3" : "fr-type-h2"}>{title}</TitleTag>
      </div>
      {description ? <p className="fr-type-body-large fr-contest-section-heading__desc">{description}</p> : null}
    </div>
  );
}

type ContentToActionsProps = CommonProps & {
  /** Si true, añade borde superior + padding (footer de formulario). */
  bordered?: boolean;
};

/**
 * Separación obligatoria contenido → botones (64px = contentToActions).
 * No usar mt-4/mt-6 alrededor de CTAs en concursos públicos.
 */
export function ContentToActions({
  children,
  className,
  id,
  as: Tag = "div",
  bordered = false,
  ...rest
}: ContentToActionsProps) {
  return (
    <Tag
      id={id}
      className={cx(
        "fr-contest-content-to-actions",
        bordered && "fr-contest-form-actions border-t border-[var(--cv-border)]",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type ContestShellProps = {
  children: ReactNode;
  cssVars: Record<string, string>;
  className?: string;
};

/** Wrapper de página pública que aplica el contrato visual vía CSS variables. */
export function ContestShell({ children, cssVars, className }: ContestShellProps) {
  return (
    <div
      className={cx("fr-contest-shell", className)}
      style={cssVars as CSSProperties}
      data-contest-visual="true"
    >
      {children}
    </div>
  );
}
