/**
 * Lugar de la foto cuando la publicación no tiene (o no se pudieron firmar): un recuadro neutro
 * con el tipo de equipo y el modelo, nunca una imagen rota.
 */
export function SinFoto({
  tipo,
  titulo,
  className,
}: {
  tipo: string;
  titulo: string;
  className?: string;
}) {
  return (
    <div className={["sin-foto", className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className="sin-foto-tipo">{tipo}</span>
      <span className="sin-foto-modelo">{titulo}</span>
    </div>
  );
}
