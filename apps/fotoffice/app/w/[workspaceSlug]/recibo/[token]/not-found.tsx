/**
 * "Enlace no disponible": token sin forma, desconocido, renovado, de otro workspace o de la otra
 * clase de enlace. No dice cuál de esos casos es (no ayuda a quien prueba tokens). Next lo dibuja
 * dentro del armazón del sitio, con estado 404.
 */
export default function EnlaceNoDisponible() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center" style={{ color: "var(--wsite-text)" }}>
      <h1 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--wsite-heading-font)" }}>
        Enlace no disponible
      </h1>
      <p className="mt-4 leading-relaxed opacity-70">
        Este enlace no existe o ya no está disponible. Si te lo mandaron hace poco, pedile a quien te lo envió uno nuevo.
      </p>
    </div>
  );
}
