"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { pedirDescargaAction } from "@/app/w/[workspaceSlug]/galeria/[token]/acciones";

type Props = {
  slug: string;
  token: string;
  /** El estudio tiene un correo válido de este cliente. */
  tieneCorreo: boolean;
  /** Hay un pedido armándose. */
  activa: boolean;
  /** Hay una descarga lista y vigente. */
  lista: boolean;
  topeAlcanzado: boolean;
};

/** «Recibir todo por correo»: arma en segundo plano un ZIP con todos los archivos y manda el enlace al correo del cliente. */
export function RecibirTodoPorCorreo({ slug, token, tieneCorreo, activa, lista, topeAlcanzado }: Props) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pedida, setPedida] = useState(false);
  const enCurso = activa || pedida;
  const rutaDescargas = `/w/${encodeURIComponent(slug)}/galeria/${encodeURIComponent(token)}/descargas`;

  function pedir() {
    setMensaje(null);
    iniciar(async () => {
      const r = await pedirDescargaAction(slug, token).catch(() => null);
      if (!r) return setMensaje({ tipo: "error", texto: "No pudimos conectar con el servidor. Probá de nuevo." });
      if (!r.ok) return setMensaje({ tipo: "error", texto: r.error });
      setPedida(true);
      setMensaje({ tipo: "ok", texto: "Listo: estamos armando tu descarga. Cuando termine te mandamos un correo con el enlace. Puede tardar unos minutos." });
    });
  }

  return (
    <section aria-label="Recibir todo por correo" className="space-y-2 rounded-lg border border-black/10 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={pedir} disabled={pendiente || enCurso || !tieneCorreo || topeAlcanzado} className="fo-btn fo-btn-secondary">
          {pendiente ? "Pidiendo…" : enCurso ? "Armando tu descarga…" : "Recibir todo por correo"}
        </button>
        {lista ? (
          <Link href={rutaDescargas} className="text-sm font-medium underline">
            Ver mi descarga lista
          </Link>
        ) : null}
      </div>
      <p className="text-sm opacity-80">
        {!tieneCorreo
          ? "Para mandarte todo junto por correo necesitamos tu dirección. Pedile al estudio que la cargue."
          : topeAlcanzado
            ? "Ya pediste la descarga 3 veces hoy. Probá mañana."
            : "Armamos un ZIP con todos tus archivos en alta calidad (en partes de hasta 1 GB) y te mandamos el enlace por correo."}
      </p>
      {mensaje ? (
        <p role={mensaje.tipo === "error" ? "alert" : "status"} className={`text-sm ${mensaje.tipo === "error" ? "text-red-700" : "text-green-800"}`}>
          {mensaje.texto}
        </p>
      ) : null}
    </section>
  );
}
