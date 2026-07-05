type Props = {
  rows?: number;
  variant?: "table" | "cards";
};

export default function CuantoCobroListSkeleton({ rows = 4, variant = "table" }: Props) {
  if (variant === "cards") {
    return (
      <div className="cc-list-skeleton cc-list-skeleton--cards" aria-busy="true" aria-label="Cargando…">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="cc-list-skeleton__card" />
        ))}
      </div>
    );
  }

  return (
    <div className="cc-list-skeleton cc-list-skeleton--table" aria-busy="true" aria-label="Cargando…">
      <div className="cc-list-skeleton__header" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="cc-list-skeleton__row" />
      ))}
    </div>
  );
}
