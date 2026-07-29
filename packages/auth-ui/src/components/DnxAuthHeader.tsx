import type { AuthLogoConfig } from "../types";

export function DnxAuthHeader({
  logo,
  title,
  description,
  contextualNotice,
}: {
  logo: AuthLogoConfig;
  title: string;
  description?: string;
  contextualNotice?: string;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.src}
      alt={logo.alt}
      style={{
        height: logo.height ?? "3.5rem",
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
      }}
    />
  );

  return (
    <header
      data-dnx-auth-slot="identity"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "1rem",
        width: "100%",
      }}
    >
      {logo.href ? (
        <a href={logo.href} style={{ display: "inline-flex" }}>
          {img}
        </a>
      ) : (
        img
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
        <h1
          data-dnx-auth-slot="title"
          style={{
            margin: 0,
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            color: "var(--auth-text-primary)",
            fontFamily: "var(--auth-font)",
            textWrap: "balance",
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            data-dnx-auth-slot="description"
            style={{
              margin: 0,
              fontSize: "0.9375rem",
              lineHeight: 1.65,
              color: "var(--auth-text-secondary)",
              fontFamily: "var(--auth-font)",
              textWrap: "balance",
            }}
          >
            {description}
          </p>
        ) : null}
        {contextualNotice ? (
          <p
            data-dnx-auth-slot="context"
            style={{
              margin: 0,
              fontSize: "0.875rem",
              lineHeight: 1.55,
              color: "var(--auth-text-secondary)",
              fontFamily: "var(--auth-font)",
            }}
          >
            {contextualNotice}
          </p>
        ) : null}
      </div>
    </header>
  );
}
