export function DnxAuthDivider({ label = "o" }: { label?: string }) {
  return (
    <div
      data-dnx-auth-slot="divider"
      role="separator"
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        width: "100%",
        margin: "0.25rem 0",
      }}
    >
      <div style={{ flex: 1, height: 1, background: "var(--auth-border)" }} />
      <span
        style={{
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--auth-text-secondary)",
          fontFamily: "var(--auth-font)",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--auth-border)" }} />
    </div>
  );
}
