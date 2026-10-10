"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EXHIBITOR_LIMITS, EXHIBITOR_TEXT_LIMITS, SUGGESTED_WORKS_PER_EXHIBITOR, type ExhibitorLinkState } from "@repo/muestras";
import { CopiarEnlace } from "@/components/enlace/copiar-enlace";
import { AjusteVisibilidad } from "@/components/visibilidad/ajuste-visibilidad";
import { cambiarEstadoEnlace, crearEnlaceExpositores, guardarEnlaceExpositores, renovarEnlaceExpositores, type ResultadoEnlace } from "@/lib/expositores/enlace";
import { botonFino, botonLleno, campo, nota, seccion } from "./estilos";

function useAccion() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const correr = (f: () => Promise<ResultadoEnlace>, listo = "Guardamos los cambios.") =>
    empezar(async () => {
      const r = await f();
      setMensaje(r.ok ? { ok: true, texto: r.aviso ?? listo } : { ok: false, texto: r.errores.join(" ") });
      if (r.ok) router.refresh();
    });
  const aviso = mensaje ? <p role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? nota : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null;
  return { pendiente, correr, aviso };
}

/**
 * Generar el enlace (spec D1, D6, D24). Si la muestra todavía no tiene ajuste de sorpresa, en el
 * mismo paso se elige qué se ve online, con "Adelanto" sugerido: sin confirmarlo no se genera.
 */
export function GenerarEnlace({ activityId, pideVisibilidad, todoALaVista = false }: { activityId: string; pideVisibilidad: boolean; todoALaVista?: boolean }) {
  const { pendiente, correr, aviso } = useAccion();
  const [sinTope, setSinTope] = useState(false);
  const enviar = (fd: FormData) => {
    fd.set("activityId", activityId);
    correr(() => crearEnlaceExpositores(fd), "Listo: ya tenés el enlace.");
  };
  return (
    <form action={enviar} className="space-y-6">
      {pideVisibilidad ? (
        <section className={seccion}>
          <h2 className="text-lg">Antes, elegí qué se ve online</h2>
          <p className="text-[15px]">
            Te sugerimos &quot;Adelanto&quot;: 3 obras al azar, siempre las mismas. Podés cambiarlo cuando quieras en Visibilidad.
          </p>
          <AjusteVisibilidad inicial={null} sugerencia="PREVIEW" todoALaVista={todoALaVista} />
          <label className="flex items-start gap-2">
            <input type="checkbox" name="visibilidadConfirmada" value="1" required className="mt-1" />
            Confirmo lo que se ve online.
          </label>
        </section>
      ) : null}
      <section className={seccion}>
        <h2 className="text-lg">Obras por expositor</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block w-32 space-y-1">
            <span className={nota}>Hasta</span>
            <input
              type="number" name="maxWorksPerExhibitor" min={EXHIBITOR_LIMITS.worksPerExhibitor[0]} max={EXHIBITOR_LIMITS.worksPerExhibitor[1]}
              defaultValue={SUGGESTED_WORKS_PER_EXHIBITOR} disabled={sinTope} className={campo}
            />
          </label>
          <label className="flex items-center gap-2 pb-2">
            <input type="checkbox" name="sinTope" value="1" checked={sinTope} onChange={(e) => setSinTope(e.target.checked)} />
            Sin tope
          </label>
        </div>
      </section>
      <p><button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Generando…" : "Generar el enlace"}</button></p>
      {aviso}
    </form>
  );
}

const ESTADOS: Record<ExhibitorLinkState, string> = {
  OPEN: "Abierto: recibe expositores y obras.",
  CLOSED: "Cerrado: no recibe expositores ni obras nuevas.",
  EXPIRED: "Pasó la fecha límite: no recibe expositores ni obras nuevas.",
  UNAVAILABLE: "La muestra ya no recibe expositores.",
};

export type DatosDelEnlace = {
  status: string;
  closesDay: string;
  maxWorksPerExhibitor: number | null;
  maxExhibitors: number | null;
  instructions: string;
};

/** El enlace ya generado: copiarlo, topes, fecha límite, instrucciones, cerrar, abrir y renovar. */
export function AdministrarEnlace({ activityId, url, estado, datos, expositores }: {
  activityId: string;
  url: string;
  estado: ExhibitorLinkState;
  datos: DatosDelEnlace;
  expositores: number;
}) {
  const { pendiente, correr, aviso } = useAccion();
  const guardar = (fd: FormData) => {
    fd.set("activityId", activityId);
    correr(() => guardarEnlaceExpositores(fd));
  };
  const abierto = datos.status === "OPEN";
  const tope = (n: number | null) => (n == null ? "sin tope" : String(n));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <CopiarEnlace url={url} etiqueta="Enlace de expositores" />
        <p className={nota}>Mandalo por WhatsApp o por mail.</p>
        <p className="text-[15px]">{ESTADOS[estado]}</p>
        <p className={nota}>
          {expositores === 1 ? "1 persona se sumó" : `${expositores} personas se sumaron`}. Obras por expositor: {tope(datos.maxWorksPerExhibitor)}. Expositores: {tope(datos.maxExhibitors)}.
        </p>
      </section>

      <form action={guardar} className={`${seccion} max-w-xl`}>
        <h2 className="text-lg">Topes, fecha límite e instrucciones</h2>
        <p className={nota}>Vacío = sin tope.</p>
        <div className="flex flex-wrap gap-4">
          <label className="block w-40 space-y-1">
            <span className={nota}>Obras por expositor</span>
            <input type="number" name="maxWorksPerExhibitor" min={1} max={EXHIBITOR_LIMITS.worksPerExhibitor[1]} defaultValue={datos.maxWorksPerExhibitor ?? ""} className={campo} />
          </label>
          <label className="block w-40 space-y-1">
            <span className={nota}>Cantidad de expositores</span>
            <input type="number" name="maxExhibitors" min={1} max={EXHIBITOR_LIMITS.exhibitors[1]} defaultValue={datos.maxExhibitors ?? ""} className={campo} />
          </label>
          <label className="block w-48 space-y-1">
            <span className={nota}>Fecha límite (optativa)</span>
            <input type="date" name="closesDay" defaultValue={datos.closesDay} className={campo} />
          </label>
        </div>
        <label className="block space-y-1">
          <span className={nota}>Instrucciones para quienes exponen</span>
          <textarea
            name="instructions" rows={4} maxLength={EXHIBITOR_TEXT_LIMITS.instructions} defaultValue={datos.instructions} className={campo}
            placeholder="Por ejemplo: 'Las copias se entregan enmarcadas el 30 de octubre en la sede'"
          />
        </label>
        <p><button type="submit" className={botonFino} disabled={pendiente}>Guardar</button></p>
      </form>

      <section className={seccion}>
        <p className="flex flex-wrap gap-3">
          <button
            type="button" className={botonFino} disabled={pendiente}
            onClick={() => correr(() => cambiarEstadoEnlace(activityId, abierto ? "CLOSED" : "OPEN"), abierto ? "Cerramos el enlace." : "El enlace volvió a abrirse.")}
          >
            {abierto ? "Cerrar el enlace" : "Volver a abrirlo"}
          </button>
          <button
            type="button" className={botonFino} disabled={pendiente}
            onClick={() => {
              if (window.confirm("¿Generar un enlace nuevo? El anterior deja de andar para quienes todavía no se sumaron.")) correr(() => renovarEnlaceExpositores(activityId));
            }}
          >
            Generar un enlace nuevo
          </button>
        </p>
      </section>
      {aviso}
    </div>
  );
}
