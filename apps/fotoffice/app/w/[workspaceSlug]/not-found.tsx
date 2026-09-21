import Link from "next/link";

/**
 * El 404 de lo público de un workspace. Next lo dibuja DENTRO del layout de este segmento, así
 * que hereda el encabezado, el pie y los colores del sitio sin hacer nada.
 *
 * No recibe `params`, así que no puede armar un enlace a `/w/<slug>`: por eso usa Link a `/`,
 * que es el home global de la plataforma.
 *
 * Ojo: cuando el layout mismo hace notFound() (slug inexistente) no hay sitio que heredar y
 * esta pantalla se ve con los colores por defecto. Es correcto: ese workspace no existe.
 */
export default function PublicWorkspaceNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center" style={{ color: "var(--wsite-text)" }}>
      <p className="text-sm font-semibold uppercase tracking-widest opacity-60">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--wsite-heading-font)" }}>
        Esta página no existe
      </h1>
      <p className="mt-4 leading-relaxed opacity-70">
        Puede que el enlace esté mal escrito, o que la página ya no esté disponible.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-sm"
        style={{
          backgroundColor: "var(--wsite-accent)",
          color: "#ffffff",
          borderRadius: "var(--wsite-button-radius)",
          paddingInline: "var(--wsite-button-padding-x)",
          paddingBlock: "var(--wsite-button-padding-y)",
          fontWeight: "var(--wsite-button-weight)",
        }}
      >
        Ir al inicio
      </Link>
    </div>
  );
}
