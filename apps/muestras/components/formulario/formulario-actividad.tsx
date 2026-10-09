"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, toArDay } from "@repo/muestras";
import { enviarARevision, guardarBorrador } from "@/lib/actividades/acciones";
import type { buscarPropia } from "@/lib/actividades/consultas";
import type { ObraForm } from "@/lib/actividades/mapear";
import { BuscadorDireccion } from "./buscador-direccion";
import { EditorObras } from "./obras";
import { subirImagen } from "./subir-imagen";

const MapaDelLugar = dynamic(() => import("@/components/mapa/mapa-del-lugar"), { ssr: false });

export type ActividadEditable = NonNullable<Awaited<ReturnType<typeof buscarPropia>>>;

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";

export function FormularioActividad({ inicial }: { inicial?: ActividadEditable }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [tipo, setTipo] = useState(inicial?.type ?? "MUESTRA");
  const [soloOnline, setSoloOnline] = useState(inicial?.isVirtualOnly ?? false);
  // Una muestra se visita en persona: para ella no existe "sólo online" (ver MUESTRA_NEEDS_VENUE).
  const esMuestra = tipo === "MUESTRA";
  const sinLugar = !esMuestra && soloOnline;
  const [portada, setPortada] = useState<string | null>(inicial?.coverImageUrl ?? null);
  const [lugar, setLugar] = useState({
    address: inicial?.address ?? "", city: inicial?.city ?? "", province: inicial?.province ?? "",
    latitude: inicial?.latitude ?? null as number | null, longitude: inicial?.longitude ?? null as number | null,
  });
  const [obras, setObras] = useState<ObraForm[]>(
    (inicial?.works ?? []).map((w) => ({
      id: w.id, imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year, technique: w.technique,
      isHighlight: w.isHighlight, authorProfileId: w.authorProfileId, authorProfileName: w.authorProfile?.displayName ?? null,
    })),
  );

  // Las obras que este editor cargó: al guardar sólo se quitan de la galería las que estaban acá.
  // Si mientras tanto se sumaron otras (p. ej. al armar la muestra en otra pestaña), se conservan.
  const [idsCargados] = useState<string[]>(() => (inicial?.works ?? []).map((w) => w.id));

  function datos(form: HTMLFormElement) {
    const fd = new FormData(form);
    if (inicial) fd.set("id", inicial.id);
    fd.set("coverImageUrl", portada ?? "");
    fd.set("address", lugar.address); fd.set("city", lugar.city); fd.set("province", lugar.province);
    fd.set("latitude", lugar.latitude?.toString() ?? ""); fd.set("longitude", lugar.longitude?.toString() ?? "");
    fd.set("works", JSON.stringify(tipo === "MUESTRA" ? obras : []));
    fd.set("idsCargados", JSON.stringify(idsCargados));
    return fd;
  }

  function guardar(form: HTMLFormElement, enviar: boolean) {
    start(async () => {
      const r = await guardarBorrador(datos(form));
      if (!r.ok) return setErrores(r.errores);
      if (enviar) {
        const e = await enviarARevision(r.id);
        if (!e.ok) {
          // Los faltantes viajan en la URL: el guardado cambia la clave del formulario (y, si es un
          // borrador nuevo, la página), así que este estado se pierde. Un borrador nuevo además
          // tiene que ir a su página para que lo próximo edite el mismo y no cree otro.
          router.replace(`/panel/muestras/${r.id}?faltan=${encodeURIComponent(e.errores.join("|"))}`);
          return;
        }
      }
      // Un aviso (por ejemplo, un perfil ajeno en una muestra publicada) no frena el guardado:
      // viaja en la URL porque el cambio de página borra este estado.
      const aviso = r.avisos?.length ? "?aviso=perfiles" : "";
      router.push(enviar ? "/panel/muestras?enviada=1" : `/panel/muestras/${r.id}${aviso}`);
    });
  }

  return (
    <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="space-y-3">
        <label className="block">Tipo de actividad
          <select name="type" className={campo} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="block">Título<input name="title" className={campo} defaultValue={inicial?.title} required /></label>
        <label className="block">Descripción<textarea name="description" rows={5} className={campo} defaultValue={inicial?.description} /></label>
        <label className="block">Organizadores<input name="organizersText" className={campo} defaultValue={inicial?.organizersText} placeholder="Personas o instituciones que la organizan" /></label>
        <div>
          <p>Foto de portada</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {portada ? <img src={portada} alt="" className="my-2 h-40 rounded object-cover" /> : null}
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try { setPortada(await subirImagen(f, "portada")); } catch (err) { setErrores([err instanceof Error ? err.message : "No pudimos subir la portada."]); }
          }} />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <label>Desde<input type="date" name="startDay" className={campo} defaultValue={inicial ? toArDay(inicial.startsAt) : ""} /></label>
        <label>Hasta<input type="date" name="endDay" className={campo} defaultValue={inicial ? toArDay(inicial.endsAt) : ""} /></label>
        <label>Inauguración (opcional)<input type="date" name="openingDay" className={campo} defaultValue={inicial?.openingAt ? toArDay(inicial.openingAt) : ""} /></label>
        <label className="sm:col-span-2">Horarios<input name="scheduleText" className={campo} defaultValue={inicial?.scheduleText ?? ""} placeholder="Mar a dom de 16 a 20" /></label>
        <label>Entrada<input name="priceText" className={campo} defaultValue={inicial?.priceText ?? ""} placeholder="Vacío = libre y gratuita" /></label>
        <label className="sm:col-span-3">Enlace (opcional)<input name="externalUrl" type="url" className={campo} defaultValue={inicial?.externalUrl ?? ""} /></label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg">{esMuestra ? "Dónde se puede visitar" : "Dónde es"}</legend>
        {esMuestra ? (
          <p className="text-sm text-[var(--mf-muted)]">La sala, galería o centro cultural donde se cuelgan las obras. Con la dirección, la muestra aparece en el mapa y la gente sabe cómo llegar.</p>
        ) : (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isVirtualOnly" checked={soloOnline} onChange={(e) => setSoloOnline(e.target.checked)} />
            Es sólo online (no tiene lugar)
          </label>
        )}
        {!sinLugar ? (
          <>
            <label className="block">{esMuestra ? "Nombre de la sede" : "Nombre del lugar"}<input name="venueName" className={campo} defaultValue={inicial?.venueName ?? ""} placeholder="Sala, galería, centro cultural…" /></label>
            <BuscadorDireccion onElegir={(l) => setLugar({ address: l.address ?? l.displayName, city: l.city ?? "", province: l.province ?? "", latitude: l.latitude, longitude: l.longitude })} />
            <p className="text-sm text-[var(--mf-muted)]">{lugar.address || "Todavía no elegiste la dirección."} Si el punto quedó corrido, tocá el mapa o arrastrá el pin.</p>
            <MapaDelLugar latitude={lugar.latitude} longitude={lugar.longitude} editable onMover={(lat, lng) => setLugar((p) => ({ ...p, latitude: lat, longitude: lng }))} alto="280px" />
          </>
        ) : null}
      </fieldset>

      {tipo === "MUESTRA" ? (
        <fieldset className="space-y-3">
          <legend className="text-lg">Obras de la muestra</legend>
          <p className="text-sm text-[var(--mf-muted)]">Mientras la muestra está abierta, la ficha muestra sólo las destacadas: un anticipo online para invitar a la visita. Cuando cierra, quedan todas como archivo de la muestra.</p>
          <EditorObras obras={obras} onCambio={setObras} />
          <label className="flex items-center gap-2">
            <input type="checkbox" name="galleryMode" value="FULL" defaultChecked={inicial?.galleryMode === "FULL"} />
            Mostrar todas las obras online desde el primer día
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="rightsConfirmed" defaultChecked={inicial?.rightsConfirmedAt != null} />
            Confirmo que tengo autorización de los autores para publicar estas imágenes, y que cada una lleva su crédito.
          </label>
        </fieldset>
      ) : null}

      {errores.length ? (
        <ul role="alert" className="rounded-[2px] bg-red-50 p-3 text-sm text-red-800">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={pendiente} className="rounded-[2px] border border-[var(--mf-line)] px-4 py-2"
          onClick={(e) => guardar(e.currentTarget.form!, false)}>Guardar borrador</button>
        <button type="button" disabled={pendiente} className="rounded-[2px] bg-[var(--mf-accent)] px-4 py-2 text-[var(--mf-accent-ink)]"
          onClick={(e) => guardar(e.currentTarget.form!, true)}>Enviar a revisión</button>
      </div>
    </form>
  );
}
