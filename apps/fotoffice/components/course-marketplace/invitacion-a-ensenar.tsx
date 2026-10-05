import { createOwnBusinessAction } from "@/app/actions/profile-choice";
import { INVITACION_A_ENSENAR as T, enlaceParaEnsenarDesdeAfuera } from "@/lib/course-marketplace/invitacion-ensenar";

/** La tarjeta "¿Querés enseñar?". En el portal crea el negocio con un clic; en lo público, lleva a registrarse. */
export function InvitacionAEnsenar(props: { modo: "portal" } | { modo: "publico"; appUrl: string }) {
  return (
    <aside className="fo-card space-y-2">
      <p className="font-semibold">{T.titulo}</p>
      <p className="text-sm text-[var(--fo-muted)]">{T.texto}</p>
      {props.modo === "portal" ? (
        <>
          <form action={createOwnBusinessAction}>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              {T.boton}
            </button>
          </form>
          <p className="text-xs text-[var(--fo-muted)]">{T.aclaracion}</p>
        </>
      ) : (
        <a href={enlaceParaEnsenarDesdeAfuera(props.appUrl)} className="fo-btn fo-btn-secondary inline-flex text-sm">
          {T.botonPublico}
        </a>
      )}
    </aside>
  );
}
