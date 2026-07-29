export function DnxAuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      data-dnx-auth-slot="error"
      role="alert"
      style={{
        width: "100%",
        borderRadius: "var(--auth-radius)",
        border: "1px solid color-mix(in srgb, var(--auth-error) 40%, transparent)",
        background: "var(--auth-error-bg)",
        color: "var(--auth-error)",
        padding: "0.875rem 1rem",
        fontSize: "0.9375rem",
        lineHeight: 1.55,
        textAlign: "center",
        fontFamily: "var(--auth-font)",
        boxSizing: "border-box",
      }}
    >
      {message}
    </div>
  );
}
