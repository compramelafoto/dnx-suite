/**
 * Máscaras negras fuera del recuadro de captura (letterbox / pillarbox).
 * El canvas sigue ocupando todo el viewport; esto oculta los márgenes.
 */
export default function ViewfinderLetterbox() {
  return (
    <div className="cod-vf-letterbox" aria-hidden="true">
      <div className="cod-vf-letterbox__panel cod-vf-letterbox__panel--top" />
      <div className="cod-vf-letterbox__panel cod-vf-letterbox__panel--bottom" />
      <div className="cod-vf-letterbox__panel cod-vf-letterbox__panel--left" />
      <div className="cod-vf-letterbox__panel cod-vf-letterbox__panel--right" />
    </div>
  );
}
