"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut } from "lucide-react";

type Sesion = { signedIn: boolean; name: string | null };

/**
 * El botón para entrar del encabezado del sitio, que se da cuenta de si ya entraste.
 *
 * Arranca como "Ingresar" —es lo que se ve en el HTML, que es el mismo para todos y se puede
 * guardar en caché— y le pregunta al servidor si hay sesión. Si la hay, se convierte en el
 * nombre de la persona con un menú: "Mi panel" (la puerta de la institución, que la lleva a
 * su portal o a la gestión según quién sea) y "Cerrar sesión", que la devuelve a la misma
 * página del sitio.
 *
 * En la vista previa del constructor (`href="#"`) no pregunta nada: ahí se diseña el sitio,
 * y mostrar el nombre de quien lo edita confundiría.
 */
export function WebsiteLoginButton({
  href,
  label,
  className,
  style,
}: {
  href: string;
  label: string;
  className: string;
  style: React.CSSProperties;
}) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const [volver, setVolver] = useState("/");

  useEffect(() => {
    if (href === "#") return;
    let vivo = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Sesion>) : null))
      .then((s) => {
        if (vivo && s?.signedIn) {
          setSesion(s);
          setVolver(window.location.pathname + window.location.search);
        }
      })
      .catch(() => {
        // Sin respuesta, queda "Ingresar": es lo seguro.
      });
    return () => {
      vivo = false;
    };
  }, [href]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => {
      if (caja.current && !caja.current.contains(ev.target as Node)) setAbierto(false);
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (!sesion) {
    return (
      <a href={href} className={className} style={style}>
        {label}
      </a>
    );
  }

  const primerNombre = (sesion.name ?? "").split(" ")[0] || "Mi cuenta";

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className={`${className} inline-flex items-center gap-1.5`}
        style={style}
      >
        <span className="max-w-[10rem] truncate">{primerNombre}</span>
        <ChevronDown className="size-4" aria-hidden />
      </button>
      {abierto ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-black/10 py-1 text-left text-sm shadow-lg"
          // Los colores del sitio de la institución, no los del panel.
          style={{ backgroundColor: "var(--wsite-bg, #fff)", color: "var(--wsite-text, #0f172a)" }}
        >
          {sesion.name ? (
            <p className="truncate border-b border-black/5 px-4 py-2 text-xs opacity-60">
              Entraste como {sesion.name}
            </p>
          ) : null}
          <a
            href={href}
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 hover:bg-black/5"
          >
            <LayoutDashboard className="size-4 opacity-60" aria-hidden />
            Mi panel
          </a>
          <form action="/api/auth/logout" method="post">
            <input type="hidden" name="next" value={volver} />
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-black/5"
            >
              <LogOut className="size-4 opacity-60" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
