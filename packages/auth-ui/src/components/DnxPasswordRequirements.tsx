const DEFAULT_ITEMS = [
  "Mínimo 8 caracteres",
  "Al menos una letra y un número",
  "Evitar contraseñas obvias o reutilizadas",
];

export function DnxPasswordRequirements({ items = DEFAULT_ITEMS }: { items?: string[] }) {
  return (
    <ul
      data-dnx-auth-slot="requirements"
      style={{
        margin: 0,
        paddingLeft: "1.25rem",
        color: "var(--auth-text-secondary)",
        fontSize: "0.875rem",
        lineHeight: 1.55,
        fontFamily: "var(--auth-font)",
      }}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
