"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ONLINE_EXHIBITED, ONLINE_EXHIBITED_LABELS, PROFILE_EXHIBITED, PROFILE_EXHIBITED_LABELS, RANDOM_ROTATIONS, RANDOM_ROTATION_LABELS,
  ROOM_EXHIBITED, ROOM_EXHIBITED_LABELS, VISIBILITY_PRESETS, VISIBILITY_PRESET_DESCRIPTIONS, VISIBILITY_PRESET_LABELS,
  visibilityFromPreset, type FixedVisibilityPreset, type VisibilityPreset,
} from "@repo/muestras";
import { guardarVisibilidad, volverASortear } from "@/lib/visibilidad/acciones";
import { sinSemilla, type AjusteSinSemilla } from "@/lib/visibilidad/forma";
import { aviso, bloque, botonFino, botonLleno, campo, nota } from "./estilos";

export type { AjusteSinSemilla };

const desdePreset = (p: FixedVisibilityPreset): AjusteSinSemilla => sinSemilla(visibilityFromPreset(p, ""));

/** Los avisos de lo elegido (spec D22, D23), para mostrar antes de guardar. */
export function avisosDeAjuste(a: AjusteSinSemilla): string[] {
  if (a.online.exhibited !== "RANDOM") return [];
  if (a.online.rotation === "DAILY") return ["Quien vuelve seguido termina viendo más obras."];
  if (a.online.rotation === "PER_VISIT") {
    return [
      `Cada visitante ve otras ${a.online.randomCount} obras. Quien entre varias veces (o use un programa) va a terminar viendo todas: si querés que la sala sea sorpresa, elegí 'Siempre las mismas' o 'Ninguna'.`,
    ];
  }
  return [];
}

/**
 * Los campos del ajuste de visibilidad (spec D20–D24): presets con su descripción y "Personalizado"
 * con los cuatro bloques. Sólo los campos: lo usa el panel de Visibilidad y el alta del enlace de
 * expositores (Task 9), cada uno dentro de su propio formulario. Tocar cualquier opción pasa a
 * "Personalizado"; elegir un preset reescribe todo.
 */
export function AjusteVisibilidad({ inicial, sugerencia }: { inicial: AjusteSinSemilla | null; sugerencia?: FixedVisibilityPreset }) {
  const [a, setA] = useState<AjusteSinSemilla>(() => inicial ?? desdePreset(sugerencia ?? "PREVIEW"));
  const [detalle, setDetalle] = useState(a.preset === "CUSTOM");
  const cambiar = (f: (x: AjusteSinSemilla) => AjusteSinSemilla) => setA((x) => ({ ...f(x), preset: "CUSTOM" as VisibilityPreset }));
  const elegir = (p: VisibilityPreset) => {
    if (p === "CUSTOM") {
      setA((x) => ({ ...x, preset: "CUSTOM" }));
      setDetalle(true);
    } else setA(desdePreset(p));
  };
  const avisos = avisosDeAjuste(a);
  const radio = "flex items-start gap-2";

  return (
    <div className="space-y-5">
      <input type="hidden" name="preset" value={a.preset} />
      <fieldset className="space-y-3">
        <legend className="sr-only">Qué se ve de la muestra</legend>
        {VISIBILITY_PRESETS.map((p) => (
          <label key={p} className="flex items-start gap-3 border border-[var(--mf-line)] p-3">
            <input type="radio" name="presetElegido" value={p} checked={a.preset === p} onChange={() => elegir(p)} className="mt-1" />
            <span>
              <span className="block font-medium">
                {VISIBILITY_PRESET_LABELS[p]}
                {sugerencia === p ? <span className={`ml-2 ${nota}`}>(sugerido)</span> : null}
              </span>
              <span className={nota}>{VISIBILITY_PRESET_DESCRIPTIONS[p]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {!detalle ? (
        <button type="button" className={`text-sm underline underline-offset-4`} onClick={() => setDetalle(true)}>Ver el detalle o personalizar</button>
      ) : (
        <div className="space-y-5">
          <fieldset className={bloque}>
            <legend className="text-lg">En la publicación online</legend>
            <p className={nota}>Obras de la sala:</p>
            {ONLINE_EXHIBITED.map((o) => (
              <label key={o} className={radio}>
                <input type="radio" name="onlineExhibited" value={o} checked={a.online.exhibited === o} onChange={() => cambiar((x) => ({ ...x, online: { ...x.online, exhibited: o } }))} className="mt-1" />
                {ONLINE_EXHIBITED_LABELS[o]}
              </label>
            ))}
            {a.online.exhibited === "RANDOM" ? (
              <div className="space-y-2 pl-6">
                <label className="block max-w-[10rem] space-y-1">
                  <span className={nota}>Cuántas</span>
                  <input
                    type="number" name="randomCount" min={1} step={1} inputMode="numeric" className={campo}
                    value={a.online.randomCount}
                    onChange={(e) => cambiar((x) => ({ ...x, online: { ...x.online, randomCount: Math.max(1, Math.floor(Number(e.target.value) || 1)) } }))}
                  />
                </label>
                {RANDOM_ROTATIONS.map((r) => (
                  <label key={r} className={radio}>
                    <input type="radio" name="rotation" value={r} checked={a.online.rotation === r} onChange={() => cambiar((x) => ({ ...x, online: { ...x.online, rotation: r } }))} className="mt-1" />
                    {RANDOM_ROTATION_LABELS[r]}
                  </label>
                ))}
              </div>
            ) : (
              <>
                <input type="hidden" name="randomCount" value={a.online.randomCount} />
                <input type="hidden" name="rotation" value={a.online.rotation} />
              </>
            )}
            <label className={radio}>
              <input type="checkbox" name="artists" checked={a.online.artists} onChange={(e) => cambiar((x) => ({ ...x, online: { ...x.online, artists: e.target.checked } }))} className="mt-1" />
              Presentar a los artistas con su biografía y su portfolio
            </label>
          </fieldset>

          <fieldset className={bloque}>
            <legend className="text-lg">En el perfil de cada artista</legend>
            {PROFILE_EXHIBITED.map((o) => (
              <label key={o} className={radio}>
                <input type="radio" name="profileExhibited" value={o} checked={a.profile.exhibited === o} onChange={() => cambiar((x) => ({ ...x, profile: { exhibited: o } }))} className="mt-1" />
                {PROFILE_EXHIBITED_LABELS[o]}
              </label>
            ))}
          </fieldset>

          <fieldset className={bloque}>
            <legend className="text-lg">Al escanear el QR de una ficha en la sala</legend>
            {ROOM_EXHIBITED.map((o) => (
              <label key={o} className={radio}>
                <input type="radio" name="roomExhibited" value={o} checked={a.room.exhibited === o} onChange={() => cambiar((x) => ({ ...x, room: { ...x.room, exhibited: o } }))} className="mt-1" />
                {ROOM_EXHIBITED_LABELS[o]}
              </label>
            ))}
            {([
              ["roomPortfolio", "portfolio", "Su portfolio"],
              ["roomOtherExhibitions", "otherExhibitions", "Las otras muestras donde expuso"],
              ["roomBuy", "buy", "El botón \"Adquirir obra\""],
            ] as const).map(([nombre, clave, texto]) => (
              <label key={nombre} className={radio}>
                <input type="checkbox" name={nombre} checked={a.room[clave]} onChange={(e) => cambiar((x) => ({ ...x, room: { ...x.room, [clave]: e.target.checked } }))} className="mt-1" />
                {texto}
              </label>
            ))}
          </fieldset>

          <fieldset className={bloque}>
            <legend className="text-lg">Cuando cierra la muestra</legend>
            <label className={radio}>
              <input type="radio" name="revealAfterClose" value="1" checked={a.revealAfterClose} onChange={() => cambiar((x) => ({ ...x, revealAfterClose: true }))} className="mt-1" />
              Mostrar todo online
            </label>
            <label className={radio}>
              <input type="radio" name="revealAfterClose" value="0" checked={!a.revealAfterClose} onChange={() => cambiar((x) => ({ ...x, revealAfterClose: false }))} className="mt-1" />
              Mantener la reserva
            </label>
          </fieldset>
        </div>
      )}

      {/* Con el detalle cerrado, los campos viajan igual (un preset los ignora en el servidor). */}
      {!detalle ? (
        <>
          <input type="hidden" name="onlineExhibited" value={a.online.exhibited} />
          <input type="hidden" name="randomCount" value={a.online.randomCount} />
          <input type="hidden" name="rotation" value={a.online.rotation} />
          {a.online.artists ? <input type="hidden" name="artists" value="1" /> : null}
          <input type="hidden" name="profileExhibited" value={a.profile.exhibited} />
          <input type="hidden" name="roomExhibited" value={a.room.exhibited} />
          {a.room.portfolio ? <input type="hidden" name="roomPortfolio" value="1" /> : null}
          {a.room.otherExhibitions ? <input type="hidden" name="roomOtherExhibitions" value="1" /> : null}
          {a.room.buy ? <input type="hidden" name="roomBuy" value="1" /> : null}
          <input type="hidden" name="revealAfterClose" value={a.revealAfterClose ? "1" : "0"} />
        </>
      ) : null}

      {avisos.map((t) => <p key={t} role="status" className={aviso}>{t}</p>)}
    </div>
  );
}

/** El formulario de la pantalla Visibilidad: el ajuste, "Guardar" y, si corresponde, "Volver a sortear". */
export function FormularioVisibilidad({ activityId, inicial, sortear }: { activityId: string; inicial: AjusteSinSemilla; sortear: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  const guardar = (fd: FormData) =>
    empezar(async () => {
      fd.set("activityId", activityId);
      const r = await guardarVisibilidad(fd);
      setMensaje(r.ok ? { ok: true, texto: `Guardamos el ajuste: ${VISIBILITY_PRESET_LABELS[r.preset]}.` } : { ok: false, texto: r.errores.join(" ") });
      if (r.ok) router.refresh();
    });
  const resortear = () =>
    empezar(async () => {
      const r = await volverASortear(activityId);
      setMensaje(r.ok ? { ok: true, texto: "Listo: online se ven otras obras." } : { ok: false, texto: r.errores.join(" ") });
      if (r.ok) router.refresh();
    });

  return (
    <form action={guardar} className="space-y-5">
      <AjusteVisibilidad inicial={inicial} />
      <p className="flex flex-wrap gap-3">
        <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</button>
        {sortear ? <button type="button" className={botonFino} disabled={pendiente} onClick={resortear}>Volver a sortear</button> : null}
      </p>
      {mensaje ? <p role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? nota : "text-[var(--mf-alerta)]"}>{mensaje.texto}</p> : null}
    </form>
  );
}
