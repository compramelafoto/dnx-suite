"use client";

/**
 * Mapa de dónde vive la comunidad, sin librerías de mapas.
 *
 * Arma el mosaico de OpenStreetMap a mano (proyección Web Mercator, la misma
 * que usan todos los mapas web) y dibuja un círculo por ciudad, más grande
 * cuanta más gente hay. Sumar Leaflet habría regenerado el lockfile de toda
 * la suite, y lo que hace falta acá es mirar, no navegar.
 *
 * Se arrastra con el mouse o el dedo y se acerca con los botones: la rueda
 * queda para bajar por la página.
 */
import { useEffect, useMemo, useRef, useState } from "react";

export type PuntoDelMapa = {
  clave: string;
  lat: number;
  lng: number;
  etiqueta: string;
  personas: { nombre: string; registrationId: string }[];
};

const TESELA = 256;
const ALTO = 520;

function aPixel(lat: number, lng: number, zoom: number) {
  const escala = TESELA * 2 ** zoom;
  const latR = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * escala,
    y: ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * escala,
  };
}

function aLatLng(x: number, y: number, zoom: number) {
  const escala = TESELA * 2 ** zoom;
  const lng = (x / escala) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / escala;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

/** El zoom más cercano que muestra todos los puntos en el recuadro. */
function encuadre(puntos: PuntoDelMapa[], ancho: number) {
  if (puntos.length === 0) return { centro: { lat: -34.6, lng: -63.6 }, zoom: 4 };
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);
  const centro = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  for (let zoom = 12; zoom >= 2; zoom--) {
    const a = aPixel(Math.max(...lats), Math.min(...lngs), zoom);
    const b = aPixel(Math.min(...lats), Math.max(...lngs), zoom);
    if (b.x - a.x < ancho - 80 && b.y - a.y < ALTO - 80) return { centro, zoom };
  }
  return { centro, zoom: 2 };
}

export function MapaDePersonas({ puntos }: { puntos: PuntoDelMapa[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(800);
  const inicial = useMemo(() => encuadre(puntos, ancho), [puntos, ancho]);
  const [vista, setVista] = useState(inicial);
  const [elegido, setElegido] = useState<PuntoDelMapa | null>(null);
  const arrastre = useRef<{ x: number; y: number; centro: { x: number; y: number } } | null>(null);

  useEffect(() => setVista(inicial), [inicial]);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAncho(Math.round(entrada.contentRect.width));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const { zoom } = vista;
  const centro = aPixel(vista.centro.lat, vista.centro.lng, zoom);
  const origen = { x: centro.x - ancho / 2, y: centro.y - ALTO / 2 };
  const maximo = 2 ** zoom;

  const teselas: { x: number; y: number; izquierda: number; arriba: number }[] = [];
  for (let tx = Math.floor(origen.x / TESELA); tx <= Math.floor((origen.x + ancho) / TESELA); tx++) {
    for (let ty = Math.floor(origen.y / TESELA); ty <= Math.floor((origen.y + ALTO) / TESELA); ty++) {
      if (ty < 0 || ty >= maximo) continue;
      teselas.push({
        x: ((tx % maximo) + maximo) % maximo,
        y: ty,
        izquierda: tx * TESELA - origen.x,
        arriba: ty * TESELA - origen.y,
      });
    }
  }

  const mayor = Math.max(1, ...puntos.map((p) => p.personas.length));
  const acercar = (delta: number) =>
    setVista((v) => ({ ...v, zoom: Math.max(2, Math.min(15, v.zoom + delta)) }));

  return (
    <div className="space-y-3">
      <div
        ref={contenedor}
        className="relative w-full cursor-grab touch-none overflow-hidden rounded-[var(--ck-radius-card)] border border-ck-border bg-[#aad3df] active:cursor-grabbing"
        style={{ height: ALTO }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          arrastre.current = { x: e.clientX, y: e.clientY, centro };
        }}
        onPointerMove={(e) => {
          const a = arrastre.current;
          if (!a) return;
          const nuevo = aLatLng(a.centro.x - (e.clientX - a.x), a.centro.y - (e.clientY - a.y), zoom);
          setVista((v) => ({ ...v, centro: nuevo }));
        }}
        onPointerUp={() => {
          arrastre.current = null;
        }}
      >
        {teselas.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${zoom}-${t.izquierda}-${t.arriba}`}
            src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{ left: t.izquierda, top: t.arriba, width: TESELA, height: TESELA }}
          />
        ))}

        {puntos.map((p) => {
          const px = aPixel(p.lat, p.lng, zoom);
          const radio = 7 + 22 * Math.sqrt(p.personas.length / mayor);
          return (
            <button
              key={p.clave}
              type="button"
              title={`${p.etiqueta}: ${p.personas.length}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setElegido(p)}
              className="absolute flex items-center justify-center rounded-full border-2 border-[#1a1a1a] bg-[#ffd400]/75 text-[11px] font-bold text-[#1a1a1a] shadow-md transition-transform hover:scale-110"
              style={{
                left: px.x - origen.x - radio,
                top: px.y - origen.y - radio,
                width: radio * 2,
                height: radio * 2,
              }}
            >
              {p.personas.length}
            </button>
          );
        })}

        <div className="absolute right-3 top-3 flex flex-col gap-1">
          {[
            { etiqueta: "+", delta: 1, nombre: "Acercar" },
            { etiqueta: "−", delta: -1, nombre: "Alejar" },
          ].map((b) => (
            <button
              key={b.nombre}
              type="button"
              aria-label={b.nombre}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => acercar(b.delta)}
              className="h-9 w-9 rounded-[var(--ck-radius-sm)] border border-[#1a1a1a]/30 bg-white text-lg font-semibold text-[#1a1a1a] shadow"
            >
              {b.etiqueta}
            </button>
          ))}
          <button
            type="button"
            aria-label="Ver todos"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setVista(inicial)}
            className="h-9 w-9 rounded-[var(--ck-radius-sm)] border border-[#1a1a1a]/30 bg-white text-xs font-semibold text-[#1a1a1a] shadow"
          >
            ⤢
          </button>
        </div>
        <p className="absolute bottom-1 right-2 rounded bg-white/80 px-1.5 text-[10px] text-[#1a1a1a]">
          ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
        </p>
      </div>

      {elegido ? (
        <div className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4">
          <p className="text-sm font-semibold text-ck-text">
            {elegido.etiqueta} · {elegido.personas.length}{" "}
            {elegido.personas.length === 1 ? "persona" : "personas"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ck-text-secondary">
            {elegido.personas.map((p) => (
              <li key={p.registrationId}>
                <a href={`/admin/personas/${p.registrationId}`} className="hover:text-ck-yellow">
                  {p.nombre}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-ck-text-muted">Tocá un círculo para ver quiénes viven ahí.</p>
      )}
    </div>
  );
}
