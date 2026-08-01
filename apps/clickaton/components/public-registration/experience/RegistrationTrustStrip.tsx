const ITEMS = [
  "Compra segura",
  "Pago protegido por Mercado Pago",
  "Confirmación inmediata por email",
  "Tus datos están protegidos",
] as const;

type Props = {
  className?: string;
};

export function RegistrationTrustStrip({ className }: Props) {
  return (
    <ul
      className={[
        "flex flex-wrap gap-x-4 gap-y-2 text-xs text-ck-text-secondary md:text-sm",
        className ?? "",
      ].join(" ")}
      aria-label="Garantías de confianza"
    >
      {ITEMS.map((item) => (
        <li key={item} className="inline-flex items-center gap-1.5">
          <span className="text-ck-text" aria-hidden>
            ✔
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
