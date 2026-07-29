export function DnxAuthNotice({
  message,
  tone = "info",
}: {
  message?: string | null;
  tone?: "info" | "success" | "warning";
}) {
  if (!message) return null;
  const color =
    tone === "success"
      ? "var(--auth-success)"
      : tone === "warning"
        ? "var(--auth-primary)"
        : "var(--auth-text-secondary)";
  const bg =
    tone === "success"
      ? "var(--auth-success-bg)"
      : tone === "warning"
        ? "color-mix(in srgb, var(--auth-primary) 12%, transparent)"
        : "transparent";

  return (
    <div
      data-dnx-auth-slot="notice"
      role="status"
      style={{
        width: "100%",
        borderRadius: "var(--auth-radius)",
        border: `1px solid ${color}`,
        background: bg,
        color,
        padding: "0.875rem 1rem",
        fontSize: "0.9375rem",
        lineHeight: 1.55,
        fontFamily: "var(--auth-font)",
        boxSizing: "border-box",
      }}
    >
      {message}
    </div>
  );
}
