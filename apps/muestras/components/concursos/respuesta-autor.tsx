"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CONTEST_EXHIBIT_TEXT, CONTEST_EXHIBIT_TEXT_VERSION, EXHIBITOR_TEXT_LIMITS, SALE_CONSENT_TEXT } from "@repo/muestras";
import { subirImagen } from "@/components/formulario/subir-imagen";
import { guardarFirmaDeAutor, responderComoAutor } from "@/lib/concursos/autor";
import type { MiAutoriaEnMuestra } from "@/lib/concursos/consultas";
import { alerta, botonChico, botonFino, botonLleno, campo, nota, seccion } from "./estilos";

type Obra = MiAutoriaEnMuestra["obras"][number];

function Errores({ errores }: { errores: string[] }) {
  return errores.length ? (
    <ul role="alert" className={`space-y-1 ${alerta}`}>{errores.map((e) => <li key={e}>{e}</li>)}</ul>
  ) : null;
}

/** El estado de la exhibición en palabras (D14, D16, D19). */
function estado(o: Obra): string {
  if (o.exhibitConsent === "ACCEPTED") {
    if (o.consentBy === "RULES") return "Las bases que aceptaste autorizan exponerla.";
    if (o.consentBy === "ORGANIZER") return "La organización marcó que la autorizaste por escrito.";
    return "Aceptaste que se exponga.";
  }
  if (o.exhibitConsent === "DECLINED") return "Preferiste que no se exponga.";
  if (o.exhibitConsent === "WITHDRAWN") return "La sacaste de la muestra.";
  return "La organización quiere exponerla y espera tu respuesta.";
}

/** Una obra traída del concurso: imagen copiada, premio, estado y las respuestas del autor (D15, D16, D19). */
export function ObraDelAutor({ obra: o, cerrada, firmaSugerida, pideFirma }: { obra: Obra; cerrada: boolean; firmaSugerida: string; pideFirma: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [aceptando, setAceptando] = useState(false);

  const responder = (accion: string, extra?: FormData) => {
    const fd = extra ?? new FormData();
    fd.set("contestWorkId", o.id);
    fd.set("accion", accion);
    fd.set("version", CONTEST_EXHIBIT_TEXT_VERSION);
    setErrores([]);
    start(async () => {
      const r = await responderComoAutor(fd);
      if (!r.ok) return setErrores(r.errores);
      setAceptando(false);
      router.refresh();
    });
  };

  const aceptar = o.exhibitConsent === "PENDING" ? "accept" : "reconsider";
  const puedeAceptar = ["PENDING", "DECLINED", "WITHDRAWN"].includes(o.exhibitConsent);

  return (
    <li className="grid gap-5 border-b border-[var(--mf-line)] py-6 sm:grid-cols-[10rem_1fr]">
      {o.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.imageUrl} alt={o.title} className="aspect-square w-40 object-contain bg-[var(--mf-surface)]" />
      ) : (
        <div className="flex aspect-square w-40 items-center justify-center bg-[var(--mf-surface)] p-3 text-center text-xs text-[var(--mf-muted)]">
          {o.exhibitConsent === "ACCEPTED" ? "La organización está copiando la imagen" : "La imagen se copia cuando aceptes"}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <p className="mf-titulo text-xl">{o.title}</p>
          <p className="text-[15px]">{o.distinction}</p>
        </div>
        <p className="text-[15px]">{estado(o)}</p>
        {o.exhibitConsent === "ACCEPTED" ? (
          <p className={nota}>
            {o.enLaMuestra ? "Está en la muestra." : "Entra a la muestra cuando la organización copie su imagen."}{" "}
            {o.seVeSuNombre ? "Se ve tu nombre." : "Figura como “Autoría reservada” hasta que confirmes cómo firmás."}
          </p>
        ) : null}

        {cerrada ? (
          <p className={nota}>La muestra ya cerró: no se pueden cambiar las respuestas.</p>
        ) : (
          <div className="space-y-3">
            {puedeAceptar && !aceptando ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={botonLleno} disabled={pendiente} onClick={() => setAceptando(true)}>Acepto que se exponga</button>
                {o.exhibitConsent === "PENDING" ? (
                  <button type="button" className={botonFino} disabled={pendiente} onClick={() => responder("decline")}>Prefiero que no</button>
                ) : null}
              </div>
            ) : null}
            {puedeAceptar && aceptando ? (
              <form
                className="space-y-3 border-l-2 border-[var(--mf-line)] pl-4"
                action={(fd) => responder(aceptar, fd)}
              >
                {pideFirma ? (
                  <label className="block space-y-1">
                    <span>Cómo firmás tus obras</span>
                    <span className={`block ${nota}`}>Así va a aparecer tu nombre en la muestra, las fichas y el catálogo.</span>
                    <input name="firma" required maxLength={EXHIBITOR_TEXT_LIMITS.displayName} defaultValue={firmaSugerida} className={campo} />
                  </label>
                ) : null}
                <label className="flex items-start gap-2 text-[15px]">
                  <input type="checkbox" required className="mt-1" />
                  <span>{CONTEST_EXHIBIT_TEXT}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Guardando…" : "Confirmar"}</button>
                  <button type="button" className={botonFino} disabled={pendiente} onClick={() => setAceptando(false)}>Cancelar</button>
                </div>
              </form>
            ) : null}
            {o.exhibitConsent === "ACCEPTED" ? (
              <button type="button" className={botonChico} disabled={pendiente} onClick={() => responder("withdraw")}>
                {o.consentBy === "RULES" ? "Prefiero que no se exponga" : "Ya no quiero que se exponga"}
              </button>
            ) : null}

            {o.forSale && o.saleConsent !== "NOT_ASKED" ? (
              <div className="space-y-2 border-t border-[var(--mf-line)] pt-3">
                <p className="text-[15px]">
                  {o.saleConsent === "PENDING"
                    ? "¿Aceptás que esta obra se ofrezca a la venta? Antes de vender te vamos a mostrar el precio y el reparto para que los confirmes."
                    : o.saleConsent === "ACCEPTED"
                      ? "Aceptaste que se ofrezca a la venta."
                      : "Preferiste que no se venda."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {o.saleConsent !== "ACCEPTED" ? (
                    <button type="button" className={botonChico} disabled={pendiente} title={SALE_CONSENT_TEXT} onClick={() => responder("acceptSale")}>
                      Acepto que se ofrezca a la venta
                    </button>
                  ) : null}
                  {o.saleConsent !== "DECLINED" ? (
                    <button type="button" className={botonChico} disabled={pendiente} onClick={() => responder("declineSale")}>Prefiero que no se venda</button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
        <Errores errores={errores} />
      </div>
    </li>
  );
}

type PerfilPropio = { displayName: string; tieneBio: boolean } | null;

/** "Cómo firmás" y el perfil de fotógrafo, con el mismo formulario del alta de expositores (D19, D28). */
export function FirmaDelAutor({ authorId, firma, nombreSugerido, perfil }: { authorId: string; firma: string | null; nombreSugerido: string; perfil: PerfilPropio }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [listo, setListo] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function cambiarAvatar(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setErrores([]);
    try {
      setAvatar(await subirImagen(file, "avatar"));
    } catch (e) {
      setErrores([e instanceof Error ? e.message : "No pudimos subir la foto."]);
    } finally {
      setSubiendo(false);
    }
  }

  const enviar = (fd: FormData) => {
    fd.set("authorId", authorId);
    fd.set("avatarUrl", avatar ?? "");
    setErrores([]);
    setListo(false);
    start(async () => {
      const r = await guardarFirmaDeAutor(fd);
      if (!r.ok) return setErrores(r.errores);
      setListo(true);
      router.refresh();
    });
  };

  const bio = (
    <label className="block space-y-1">
      <span>Biografía</span>
      <span className={`block ${nota}`}>Contá quién sos y qué fotografiás. Es lo que va a leer el público de la muestra.</span>
      <textarea name="bio" rows={5} className={campo} />
    </label>
  );

  return (
    <form action={enviar} className={seccion}>
      <h2 className="text-lg">Cómo firmás</h2>
      <p className={nota}>
        Así va a aparecer tu nombre en la muestra, las fichas y el catálogo. Confirmarlo también autoriza que se publique tu nombre junto a tus obras.
      </p>
      <input name="firma" required maxLength={EXHIBITOR_TEXT_LIMITS.displayName} defaultValue={firma ?? perfil?.displayName ?? nombreSugerido} className={campo} />
      {perfil ? (
        perfil.tieneBio ? (
          <p className={nota}>Vamos a usar tu perfil de fotógrafo ({perfil.displayName}). Podés cambiarlo cuando quieras en &quot;Mi perfil de fotógrafo&quot;.</p>
        ) : (
          bio
        )
      ) : (
        <div className="space-y-4">
          <p className={nota}>Con tu firma armamos tu perfil de fotógrafo: tu página pública, para todas las muestras donde expongas.</p>
          <div className="flex items-center gap-5">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-20 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="size-20 rounded-full bg-[var(--mf-surface)]" />
            )}
            <label className="cursor-pointer underline underline-offset-4">
              {subiendo ? "Subiendo…" : avatar ? "Cambiar foto" : "Subir tu foto"}
              <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => cambiarAvatar(e.target.files?.[0])} />
            </label>
          </div>
          {bio}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1"><span>Ciudad</span><input name="city" className={campo} /></label>
            <label className="block space-y-1"><span>Provincia</span><input name="province" className={campo} /></label>
            <label className="block space-y-1"><span>Instagram</span><input name="instagram" placeholder="@usuario" className={campo} /></label>
          </div>
        </div>
      )}
      <Errores errores={errores} />
      {listo ? <p className={nota}>Listo: guardamos cómo firmás.</p> : null}
      <p>
        <button type="submit" className={botonFino} disabled={pendiente || subiendo}>{pendiente ? "Guardando…" : "Guardar cómo firmo"}</button>
      </p>
    </form>
  );
}
