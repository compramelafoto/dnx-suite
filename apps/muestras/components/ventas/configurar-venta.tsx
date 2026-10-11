"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AUTHORS_SHARE_BPS, PLATFORM_FEE_BPS, splitExample, splitProblems } from "@repo/muestras";
import { cambiarEstadoDeVenta, cambiarQuienCobra, guardarVenta } from "@/lib/ventas/configurar";
import { alerta, aviso, botonChico, botonFino, botonLleno, campo, etiqueta, nota, seccion } from "./estilos";

export type VentaInicial = {
  status: string;
  organizerBps: number | null;
  photographerBps: number | null;
  pickupText: string | null;
  shippingEnabled: boolean;
  shippingCostArs: number | null;
  shippingText: string | null;
  extraTerms: string | null;
  organizerUserId: number | null;
};

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;
const EJEMPLO = 100_000;

type Resultado = { ok: true; aviso?: string } | { ok: false; errores: string[] };

function useAccion() {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [hecho, setHecho] = useState<string | null>(null);
  const correr = (fn: () => Promise<Resultado>, ok?: string) => {
    setErrores([]);
    setHecho(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) return setErrores(r.errores);
      setHecho(r.aviso ?? ok ?? null);
      router.refresh();
    });
  };
  return { pendiente, errores, hecho, correr };
}

function Mensajes({ errores, hecho }: { errores: string[]; hecho: string | null }) {
  return (
    <>
      {errores.length ? <ul role="alert" className={`space-y-1 ${alerta}`}>{errores.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {hecho ? <p role="status" className={nota}>{hecho}</p> : null}
    </>
  );
}

/** Reparto, entrega y condiciones (spec D6, D26). En lectura para la coorganización. */
export function ConfigurarVenta({ activityId, inicial, edita }: { activityId: string; inicial: VentaInicial; edita: boolean }) {
  const { pendiente, errores, hecho, correr } = useAccion();
  const [org, setOrg] = useState(inicial.organizerBps != null ? String(inicial.organizerBps / 100) : "");
  const [foto, setFoto] = useState(inicial.photographerBps != null ? String(inicial.photographerBps / 100) : "");
  const [envio, setEnvio] = useState(inicial.shippingEnabled);

  const orgBps = /^\d{1,2}$/.test(org) ? Number(org) * 100 : Number.NaN;
  const fotoBps = /^\d{1,2}$/.test(foto) ? Number(foto) * 100 : Number.NaN;
  const valido = !Number.isNaN(orgBps) && !Number.isNaN(fotoBps) && splitProblems({ organizerBps: orgBps, photographerBps: fotoBps }).length === 0;
  const ejemplo = valido ? splitExample(EJEMPLO, { platformFeeBps: PLATFORM_FEE_BPS, organizerBps: orgBps }) : null;
  const total = AUTHORS_SHARE_BPS / 100;

  return (
    <form className="space-y-8" action={(fd) => correr(() => guardarVenta(activityId, fd), "Guardamos la configuración de la venta.")}>
      <fieldset className={seccion} disabled={!edita || pendiente}>
        <legend className="mf-titulo text-2xl">Reparto</legend>
        <p className="text-[15px]">
          La plataforma se queda con el {PLATFORM_FEE_BPS / 100} % del precio de cada obra (de ahí sale también la comisión de Mercado Pago). La organización y el fotógrafo/a se reparten el {total} % restante: elegí cuánto le toca a cada uno.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={etiqueta}>
            <span>Plataforma</span>
            <input value={`${PLATFORM_FEE_BPS / 100} %`} readOnly disabled className={campo} />
          </label>
          <label className={etiqueta}>
            <span>Organización (%)</span>
            <input name="organizacion" inputMode="numeric" pattern="\d{1,2}" required value={org} onChange={(e) => {
              setOrg(e.target.value);
              if (/^\d{1,2}$/.test(e.target.value) && Number(e.target.value) <= total) setFoto(String(total - Number(e.target.value)));
            }} className={campo} />
          </label>
          <label className={etiqueta}>
            <span>Fotógrafo/a (%)</span>
            <input name="fotografo" inputMode="numeric" pattern="\d{1,2}" required value={foto} onChange={(e) => setFoto(e.target.value)} className={campo} />
          </label>
        </div>
        {ejemplo ? (
          <p className={nota}>
            De una venta de {pesos(EJEMPLO)}: plataforma {pesos(ejemplo.plataforma)}, organización {pesos(ejemplo.organizacion)}, fotógrafo/a {pesos(ejemplo.fotografo)}.
          </p>
        ) : (
          <p className={nota}>Los dos porcentajes tienen que sumar {total}.</p>
        )}
        <p className={aviso}>Los autores tienen que aceptar este reparto antes de que se venda una obra suya. Si lo cambiás, lo tienen que aceptar de nuevo.</p>
      </fieldset>

      <fieldset className={seccion} disabled={!edita || pendiente}>
        <legend className="mf-titulo text-2xl">Entrega de las impresas</legend>
        <p className={nota}>Las copias impresas las imprime y entrega la organización. Las digitales se descargan desde el pedido.</p>
        <label className={etiqueta}>
          <span>Retiro en la sede</span>
          <span className={`block ${nota}`}>Por ejemplo: “Retirala en la sede a partir del cierre, de martes a domingo de 15 a 20”.</span>
          <textarea name="retiro" rows={3} maxLength={500} defaultValue={inicial.pickupText ?? ""} className={campo} />
        </label>
        <label className="flex items-center gap-2 text-[15px]">
          <input type="checkbox" name="envio" checked={envio} onChange={(e) => setEnvio(e.target.checked)} />
          <span>También hacemos envíos</span>
        </label>
        {envio ? (
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <label className={etiqueta}>
              <span>Costo del envío ($)</span>
              <input name="costoEnvio" inputMode="numeric" pattern="\d{1,7}" required defaultValue={inicial.shippingCostArs ?? ""} className={campo} />
            </label>
            <label className={etiqueta}>
              <span>Zona y plazo</span>
              <input name="textoEnvio" maxLength={300} defaultValue={inicial.shippingText ?? ""} placeholder="Envíos a todo el país, en 10 días hábiles" className={campo} />
            </label>
          </div>
        ) : null}
        <p className={nota}>El costo del envío va entero a la organización (no se reparte).</p>
      </fieldset>

      <fieldset className={seccion} disabled={!edita || pendiente}>
        <legend className="mf-titulo text-2xl">Condiciones de la organización</legend>
        <label className={etiqueta}>
          <span>Optativas: se muestran debajo de los términos de la venta</span>
          <textarea name="condiciones" rows={4} maxLength={1500} defaultValue={inicial.extraTerms ?? ""} className={campo} />
        </label>
      </fieldset>

      {edita ? (
        <div className="space-y-3">
          <button type="submit" className={botonLleno} disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</button>
          <Mensajes errores={errores} hecho={hecho} />
        </div>
      ) : (
        <p className={nota}>Tu rol ve la configuración en lectura: la cambia quien organiza.</p>
      )}
    </form>
  );
}

/** Abrir o pausar la venta. */
export function EstadoDeVenta({ activityId, status }: { activityId: string; status: string | null }) {
  const { pendiente, errores, hecho, correr } = useAccion();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "OPEN" ? (
          <button type="button" className={botonFino} disabled={pendiente} onClick={() => correr(() => cambiarEstadoDeVenta(activityId, "PAUSED"), "Pausamos la venta.")}>
            Pausar la venta
          </button>
        ) : status !== "CLOSED" ? (
          <button type="button" className={botonLleno} disabled={pendiente || status == null} onClick={() => correr(() => cambiarEstadoDeVenta(activityId, "OPEN"), "La venta está abierta.")}>
            Abrir la venta
          </button>
        ) : null}
      </div>
      {status == null ? <p className={nota}>Guardá el reparto y la entrega para poder abrir la venta.</p> : null}
      <Mensajes errores={errores} hecho={hecho} />
    </div>
  );
}

/** "Cambiar quién cobra" (sólo el dueño o el super admin). */
export function QuienCobra({ activityId, actual, opciones }: { activityId: string; actual: number; opciones: { userId: number; nombre: string }[] }) {
  const { pendiente, errores, hecho, correr } = useAccion();
  const [elegido, setElegido] = useState(String(actual));
  if (opciones.length < 2) return null;
  return (
    <div className="space-y-2">
      <label className={etiqueta}>
        <span>Quién cobra por la organización</span>
        <select value={elegido} onChange={(e) => setElegido(e.target.value)} className={campo}>
          {opciones.map((o) => <option key={o.userId} value={o.userId}>{o.nombre}</option>)}
        </select>
      </label>
      <button
        type="button"
        className={botonChico}
        disabled={pendiente || Number(elegido) === actual}
        onClick={() => correr(() => cambiarQuienCobra(activityId, Number(elegido)), "Cambiamos quién cobra.")}
      >
        Cambiar quién cobra
      </button>
      <Mensajes errores={errores} hecho={hecho} />
    </div>
  );
}
