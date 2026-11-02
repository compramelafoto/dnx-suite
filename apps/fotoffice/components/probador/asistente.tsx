"use client";

import { useState, type ReactNode } from "react";
import { pedirCuadrosAction, pedirSubidasAction } from "@/app/w/[workspaceSlug]/probador-de-cuadros/actions";
import type { ApiProbador } from "./motor";

/**
 * El paso a paso público del probador: lo que el cliente ve en el celular. Cada paso explica una
 * sola cosa y muestra sólo sus controles (los demás bloques del probador se esconden por CSS con
 * `data-en`). El motor es el mismo del editor del panel.
 */

export const PASOS = [
  "Sacale una foto a tu pared",
  "Marcá algo que sepas cuánto mide",
  "Elegí cómo querés tus cuadros",
  "Subí tus fotos",
  "Mirá cómo queda",
  "Tu pedido",
] as const;

export type DatosAsistente = { slug: string; puedePedir: boolean };

const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function EncabezadoPaso({ paso }: { paso: number }) {
  return (
    <div className="pdc-paso-encabezado">
      <p className="pdc-paso-numero">Paso {paso} de {PASOS.length}</p>
      <h2 className="pdc-paso-titulo">{PASOS[paso - 1]}</h2>
      <div className="pdc-progreso" aria-hidden="true"><span style={{ width: `${(paso / PASOS.length) * 100}%` }} /></div>
    </div>
  );
}

type Referencia = "A4" | "PUERTA" | "OTRA" | null;

/** Lo que dice y ofrece cada paso, arriba de sus controles. */
export function GuiaDelPaso(props: {
  paso: number;
  api: ApiProbador | null;
  referencia: Referencia;
  elegirReferencia: (r: Referencia) => void;
  raiz: () => HTMLElement | null;
  datos: DatosAsistente;
}) {
  const { paso, api } = props;
  if (paso === 1) {
    return (
      <Guia>
        <ul className="pdc-consejos">
          <li>Parate <b>bien de frente</b> a la pared, a unos 3 o 4 pasos.</li>
          <li>Que se vea la pared entera y, si podés, el piso.</li>
          <li>Con luz de día y sin flash.</li>
          <li>Para que las medidas salgan exactas, <b>pegá una hoja A4</b> en la pared antes de sacar la foto.</li>
        </ul>
        <div className="pdc-fila">
          <label className="pdc-btn pdc-btn-principal pdc-grande" htmlFor="pdc-archivo-pared-camara">Sacar la foto</label>
          <label className="pdc-btn pdc-grande" htmlFor="pdc-archivo-pared">Elegir de la galería</label>
        </div>
        {api?.paredPropia() ? <p className="pdc-ok">¡Listo! Ya tenemos tu pared. Tocá «Siguiente».</p> : (
          <button type="button" className="pdc-enlace" onClick={() => props.raiz()?.querySelector<HTMLButtonElement>('[data-pdc="living"]')?.click()}>
            O probá primero con un living de ejemplo
          </button>
        )}
      </Guia>
    );
  }
  if (paso === 2) {
    if (!api?.paredPropia()) return <Guia><p>En el living de ejemplo la medida ya está marcada. Tocá «Siguiente».</p></Guia>;
    const opciones: { id: Exclude<Referencia, null>; titulo: string; detalle: string }[] = [
      { id: "A4", titulo: "Una hoja A4 pegada en la pared", detalle: "21 × 29,7 cm · la opción más exacta" },
      { id: "PUERTA", titulo: "Una puerta", detalle: "80 × 200 cm, desde el piso" },
      { id: "OTRA", titulo: "Otra cosa que sepas cuánto mide", detalle: "un mueble, un cuadro, la pared entera…" },
    ];
    return (
      <Guia>
        <p>Así sabemos el tamaño real de tu pared. ¿Qué se ve en tu foto?</p>
        <div className="pdc-opciones">
          {opciones.map((o) => (
            <button key={o.id} type="button" className="pdc-opcion" aria-pressed={props.referencia === o.id} onClick={() => props.elegirReferencia(o.id)}>
              <b>{o.titulo}</b><span>{o.detalle}</span>
            </button>
          ))}
        </div>
        {props.referencia === "OTRA" ? <OtraMedida api={api} /> : null}
        {props.referencia ? <p className="pdc-ok">Ahora arrastrá los <b>4 puntos</b> de la foto hasta las 4 esquinas de lo que elegiste.</p> : null}
      </Guia>
    );
  }
  if (paso === 3) return <Guia><p>Tocá una forma y elegí si lo querés en canvas, MDF o impresión, y de qué medida. El precio se actualiza solo.</p></Guia>;
  if (paso === 4) {
    return (
      <Guia>
        <p>Subí la foto (o las fotos) que querés en los cuadros. Si marcaste «una sola foto», se reparte entre todos.</p>
        {api?.esMuestra() ? <p className="pdc-nota">Por ahora ves fotos de muestra.</p> : <p className="pdc-ok">¡Tus fotos ya están en los cuadros!</p>}
      </Guia>
    );
  }
  if (paso === 5) return <Guia><p>Tocá un cuadro para moverlo, cambiarlo o ajustar la foto. Tocalo dos veces para correr la foto dentro del cuadro.</p></Guia>;
  return <Pedido api={api} datos={props.datos} />;
}

function Guia({ children }: { children: ReactNode }) {
  return <section className="pdc-bloque pdc-guia">{children}</section>;
}

function OtraMedida({ api }: { api: ApiProbador }) {
  const [ancho, setAncho] = useState("");
  const [alto, setAlto] = useState("");
  const [piso, setPiso] = useState(false);
  const aplicar = (a: string, b: string, p: boolean) => {
    const w = Number(a), h = Number(b);
    if (w >= 10 && h >= 10) api.fijarReferencia(w, h, p);
  };
  return (
    <div className="pdc-campos">
      <label className="pdc-campo">Ancho (cm)
        <input type="number" inputMode="numeric" value={ancho} onChange={(e) => { setAncho(e.target.value); aplicar(e.target.value, alto, piso); }} />
      </label>
      <label className="pdc-campo">Alto (cm)
        <input type="number" inputMode="numeric" value={alto} onChange={(e) => { setAlto(e.target.value); aplicar(ancho, e.target.value, piso); }} />
      </label>
      <label className="pdc-check" style={{ gridColumn: "1 / -1" }}>
        <input type="checkbox" checked={piso} onChange={(e) => { setPiso(e.target.checked); aplicar(ancho, alto, e.target.checked); }} /> Llega hasta el piso
      </label>
    </div>
  );
}

/** Las fotos de iPhone (HEIC) se pasan a JPEG en el navegador cuando se puede, así el laboratorio las abre siempre. */
async function paraSubir(f: File): Promise<File> {
  const esHeic = /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
  if (!esHeic) return f.type ? f : new File([f], f.name, { type: "image/jpeg" });
  try {
    const bmp = await createImageBitmap(f);
    const c = document.createElement("canvas");
    c.width = bmp.width; c.height = bmp.height;
    c.getContext("2d")!.drawImage(bmp, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    return blob ? new File([blob], f.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

function subir(url: string, archivo: File, alAvanzar: (bytes: number) => void): Promise<void> {
  return new Promise((ok, mal) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", archivo.type);
    x.upload.onprogress = (e) => alAvanzar(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : mal(new Error(String(x.status))));
    x.onerror = () => mal(new Error("red"));
    x.send(archivo);
  });
}

function Pedido({ api, datos }: { api: ApiProbador | null; datos: DatosAsistente }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [estado, setEstado] = useState<{ tipo: "quieto" } | { tipo: "subiendo"; avance: number } | { tipo: "pagando" } | { tipo: "error"; texto: string }>({ tipo: "quieto" });
  if (!api) return null;
  if (!datos.puedePedir) {
    return (
      <Guia>
        <p>Este estudio todavía no toma pedidos online. Tocá «Ver imagen final», guardala y mandásela por WhatsApp para encargarlo.</p>
      </Guia>
    );
  }
  if (api.esMuestra()) return <Guia><p>Para pedir tus cuadros primero subí tus fotos: volvé al paso 4.</p></Guia>;
  const total = api.total();
  const ocupado = estado.tipo === "subiendo" || estado.tipo === "pagando";

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (!api) return;
    try {
      const { pedido, fotos } = api.pedido();
      const archivos = await Promise.all(fotos.map((f) => paraSubir(f.archivo)));
      const s = await pedirSubidasAction(datos.slug, archivos.map((a) => ({ tipo: a.type, bytes: a.size })));
      if (!s.ok) return setEstado({ tipo: "error", texto: s.error });
      const totalBytes = archivos.reduce((t, a) => t + a.size, 0) || 1;
      const avance = archivos.map(() => 0);
      setEstado({ tipo: "subiendo", avance: 0 });
      await Promise.all(archivos.map((a, i) => subir(s.subidas[i].url, a, (b) => {
        avance[i] = b;
        setEstado({ tipo: "subiendo", avance: Math.round((avance.reduce((t, x) => t + x, 0) / totalBytes) * 100) });
      })));
      setEstado({ tipo: "pagando" });
      const r = await pedirCuadrosAction(datos.slug, {
        nombre, email, telefono, borrador: s.borrador,
        fotos: fotos.map((f, i) => ({ indice: f.indice, n: s.subidas[i].n, ext: s.subidas[i].ext })),
        pedido,
      });
      if (!r.ok) return setEstado({ tipo: "error", texto: r.error });
      window.location.href = r.checkoutUrl;
    } catch {
      setEstado({ tipo: "error", texto: "No pudimos subir tus fotos. Revisá la conexión y probá de nuevo." });
    }
  }

  return (
    <form className="pdc-bloque pdc-guia" onSubmit={pagar}>
      <p>Revisá el total, dejanos tus datos y pagá con Mercado Pago. Retirás tus cuadros en el estudio; te avisamos cuando estén listos.</p>
      <label className="pdc-campo">Nombre y apellido
        <input required autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </label>
      <label className="pdc-campo">Correo
        <input required type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="pdc-campo">Teléfono (opcional)
        <input type="tel" autoComplete="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      </label>
      {estado.tipo === "error" ? <p className="pdc-error">{estado.texto}</p> : null}
      {estado.tipo === "subiendo" ? (
        <div className="pdc-subida"><p>Subiendo tus fotos… {estado.avance}%</p><div className="pdc-progreso"><span style={{ width: `${estado.avance}%` }} /></div></div>
      ) : null}
      {estado.tipo === "pagando" ? <p>Abriendo Mercado Pago…</p> : null}
      <button type="submit" className="pdc-btn pdc-btn-principal pdc-grande" disabled={ocupado || total <= 0}>
        Pagar {pesos(total)} con Mercado Pago
      </button>
    </form>
  );
}
