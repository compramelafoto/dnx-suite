/** Estrellas de una lección (0 a 3). */
export default function Stars({ value, size = "md" }: { value: number; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`cod-stars cod-stars--${size}`} aria-label={`${value} de 3 estrellas`} role="img">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= value ? "is-on" : ""} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
