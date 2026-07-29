export type DnxProfileOption = {
  id: string;
  label: string;
  description?: string;
  href: string;
};

/**
 * Selector post-login. No es identidad: solo elige membership/contexto.
 */
export function DnxProfileSwitcher({
  title = "Elegí cómo querés continuar",
  profiles,
}: {
  title?: string;
  profiles: DnxProfileOption[];
}) {
  return (
    <div data-dnx-auth-slot="profile-switcher" style={{ display: "grid", gap: "1rem" }}>
      <h2
        style={{
          margin: 0,
          fontSize: "1.25rem",
          color: "var(--auth-text-primary)",
          fontFamily: "var(--auth-font)",
        }}
      >
        {title}
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}>
        {profiles.map((p) => (
          <li key={p.id}>
            <a
              href={p.href}
              style={{
                display: "block",
                padding: "1rem 1.25rem",
                borderRadius: "var(--auth-radius)",
                border: "1px solid var(--auth-border)",
                color: "var(--auth-text-primary)",
                textDecoration: "none",
                fontFamily: "var(--auth-font)",
              }}
            >
              <strong style={{ display: "block" }}>{p.label}</strong>
              {p.description ? (
                <span style={{ color: "var(--auth-text-secondary)", fontSize: "0.875rem" }}>
                  {p.description}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
