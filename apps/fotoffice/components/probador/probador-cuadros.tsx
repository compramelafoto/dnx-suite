"use client";

import { useEffect, useRef } from "react";
import { montarProbador } from "./motor";

/**
 * El probador de cuadros: el cliente saca una foto de su pared, marca algo cuya medida conoce y
 * arma su conjunto a escala, editando cada cuadro por separado (medida, lugar, encuadre,
 * inclinación) con deshacer y rehacer.
 *
 * El marcado es fijo y React lo dibuja una sola vez; todo lo que cambia (el lienzo, los paneles,
 * las miniaturas, las medidas) lo maneja `montarProbador` sobre los `data-pdc`.
 * Los colores salen del sitio de cada estudio (`--wsite-*`, ver `PublicSiteShell`); dentro del
 * panel, donde esas variables no existen, toma las del panel (`--fo-*`).
 */
export function ProbadorCuadros() {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => (raiz.current ? montarProbador(raiz.current) : undefined), []);

  return (
    <div ref={raiz} className="pdc">
      <style>{CSS}</style>
      <div className="pdc-layout">
        <section className="pdc-escena">
          <div className="pdc-barra">
            <div className="pdc-seg" role="group" aria-label="Qué querés hacer">
              <button type="button" data-pdc="modo-pared" aria-pressed="false">1 · Marcar pared</button>
              <button type="button" data-pdc="modo-ubicar" aria-pressed="true">2 · Ubicar cuadros</button>
            </div>
            <div className="pdc-fila pdc-historial">
              <button type="button" className="pdc-btn pdc-icono" data-pdc="deshacer" aria-label="Deshacer" title="Deshacer (⌘Z)">↶</button>
              <button type="button" className="pdc-btn pdc-icono" data-pdc="rehacer" aria-label="Rehacer" title="Rehacer (⇧⌘Z)">↷</button>
            </div>
            <span className="pdc-pista" data-pdc="pista" />
          </div>
          <div className="pdc-fondo">
            <canvas
              data-pdc="lienzo"
              className="pdc-lienzo"
              tabIndex={0}
              aria-label="Foto de la pared con los cuadros. Tocá un cuadro para editarlo; con las flechas lo movés."
            />
          </div>
          <div className="pdc-medidas" data-pdc="medidas" />
        </section>

        <aside className="pdc-panel">
          <section className="pdc-bloque">
            <h2>Tu pared</h2>
            <div className="pdc-fila">
              <label className="pdc-btn pdc-btn-principal" htmlFor="pdc-archivo-pared">Sacar o subir foto</label>
              <input type="file" id="pdc-archivo-pared" data-pdc="archivo-pared" accept="image/*" hidden />
              <button type="button" className="pdc-btn" data-pdc="living">Living de ejemplo</button>
            </div>
            <p className="pdc-nota">
              Marcá con los 4 puntos algo cuya medida sepas: la pared entera, una puerta o un mueble. Después cargá su
              ancho y alto.
            </p>
            <div className="pdc-campos">
              <label className="pdc-campo" htmlFor="pdc-ref-ancho">
                Ancho de lo marcado
                <span className="pdc-unidad">
                  <input type="number" id="pdc-ref-ancho" data-pdc="ref-ancho" min={10} max={2000} step={1} /> cm
                </span>
              </label>
              <label className="pdc-campo" htmlFor="pdc-ref-alto">
                Alto de lo marcado
                <span className="pdc-unidad">
                  <input type="number" id="pdc-ref-alto" data-pdc="ref-alto" min={10} max={2000} step={1} /> cm
                </span>
              </label>
            </div>
            <label className="pdc-check">
              <input type="checkbox" data-pdc="piso" /> El borde de abajo de lo marcado es el piso
            </label>
            <p className="pdc-error" data-pdc="error-pared" hidden />
          </section>

          <section className="pdc-bloque" data-pdc="panel-conjunto">
            <h2>Conjunto</h2>
            <div className="pdc-chips" data-pdc="composiciones" />
            <div className="pdc-campos">
              <label className="pdc-campo" htmlFor="pdc-medida-todos">
                Medida base
                <select id="pdc-medida-todos" data-pdc="medida-todos" />
              </label>
              <label className="pdc-campo" htmlFor="pdc-orientacion-todos">
                Orientación
                <select id="pdc-orientacion-todos" data-pdc="orientacion-todos" defaultValue="v">
                  <option value="v">Vertical</option>
                  <option value="h">Horizontal</option>
                </select>
              </label>
            </div>
            <label className="pdc-campo" htmlFor="pdc-separacion">
              <span>Separación entre cuadros: <output data-pdc="separacion-valor" /></span>
              <input type="range" id="pdc-separacion" data-pdc="separacion" min={2} max={20} step={1} />
            </label>
            <p className="pdc-nota">Cambiar la plantilla, la medida o la separación rearma el conjunto.</p>
            <div className="pdc-campo">
              Tipo, para todos
              <div className="pdc-seg pdc-seg-ancho" role="group" aria-label="Tipo de cuadro para todos" data-pdc="tipo-todos" />
            </div>
            <label className="pdc-check">
              <input type="checkbox" data-pdc="una-foto" /> Una sola foto repartida entre todos los cuadros
            </label>
            <div className="pdc-campos">
              <label className="pdc-campo" htmlFor="pdc-paspartu-todos">
                Paspartú
                <select id="pdc-paspartu-todos" data-pdc="paspartu-todos" />
              </label>
              <label className="pdc-campo" htmlFor="pdc-modelo-marco">
                <span>Modelo de marco <span className="pdc-tag">Próximamente</span></span>
                <select id="pdc-modelo-marco" disabled defaultValue="negro">
                  <option value="negro">Negro</option>
                </select>
              </label>
            </div>
          </section>

          <section className="pdc-bloque" data-pdc="panel-cuadro" hidden>
            <div className="pdc-fila pdc-entre">
              <h2 data-pdc="titulo-cuadro">Este cuadro</h2>
              <button type="button" className="pdc-btn" data-pdc="listo">Listo</button>
            </div>
            <div className="pdc-seg pdc-seg-ancho" role="group" aria-label="Tipo de este cuadro" data-pdc="tipo-cuadro" />
            <div className="pdc-campos">
              <label className="pdc-campo" htmlFor="pdc-medida-cuadro">
                Medida
                <select id="pdc-medida-cuadro" data-pdc="medida-cuadro" />
              </label>
              <label className="pdc-campo" htmlFor="pdc-orientacion-cuadro">
                Orientación
                <select id="pdc-orientacion-cuadro" data-pdc="orientacion-cuadro" defaultValue="v">
                  <option value="v">Vertical</option>
                  <option value="h">Horizontal</option>
                </select>
              </label>
            </div>
            <div className="pdc-fila">
              <button type="button" className="pdc-btn pdc-btn-principal" data-pdc="encuadrar" aria-pressed="false">Encuadrar foto</button>
              <button type="button" className="pdc-btn" data-pdc="rotar-foto">Rotar 90°</button>
              <button type="button" className="pdc-btn" data-pdc="centrar-foto">Centrar foto</button>
            </div>
            <p className="pdc-nota" data-pdc="nota-una-foto" hidden>La foto es la misma para todo el conjunto: lo que cambies acá mueve a todos.</p>
            <label className="pdc-campo" htmlFor="pdc-zoom">
              Zoom
              <input type="range" id="pdc-zoom" data-pdc="zoom" step={0.01} />
            </label>
            <div className="pdc-campo">
              <label htmlFor="pdc-inclinacion">Inclinación: <output data-pdc="inclinacion-valor" /></label>
              <div className="pdc-fila pdc-centro">
                <input type="range" id="pdc-inclinacion" data-pdc="inclinacion" step={0.5} className="pdc-flex" />
                <button type="button" className="pdc-btn" data-pdc="inclinacion-cero">0°</button>
              </div>
            </div>
            <label className="pdc-campo" htmlFor="pdc-paspartu-cuadro">
              Paspartú (solo con marco)
              <select id="pdc-paspartu-cuadro" data-pdc="paspartu-cuadro" />
            </label>
            <div className="pdc-fila">
              <button type="button" className="pdc-btn" data-pdc="duplicar">Duplicar cuadro</button>
              <button type="button" className="pdc-btn" data-pdc="quitar">Quitar cuadro</button>
            </div>
          </section>

          <section className="pdc-bloque">
            <h2>
              Fotos <span className="pdc-tag" data-pdc="etiqueta-muestras">Muestras</span>
            </h2>
            <div className="pdc-fila">
              <label className="pdc-btn" htmlFor="pdc-archivo-fotos">Agregar tus fotos</label>
              <input type="file" id="pdc-archivo-fotos" data-pdc="archivo-fotos" accept="image/*" multiple hidden />
              <button type="button" className="pdc-btn" data-pdc="rotar">Rotar fotos</button>
            </div>
            <p className="pdc-nota" data-pdc="nota-fotos">
              Tocá un cuadro en la pared y después una foto para ponerla ahí.
            </p>
            <div className="pdc-miniaturas" data-pdc="miniaturas" />
            <p className="pdc-error" data-pdc="error-fotos" hidden />
          </section>

          <section className="pdc-bloque">
            <h2>Posición</h2>
            <div className="pdc-fila">
              <button type="button" className="pdc-btn" data-pdc="centrar">Centrar a lo ancho</button>
              <button type="button" className="pdc-btn" data-pdc="altura-galeria">Centro a 150 cm del piso</button>
            </div>
            <p className="pdc-nota">
              En galerías se cuelga con el centro del conjunto entre 145 y 150 cm del piso, a la altura de la vista.
              Sobre un sillón, dejá unos 20 a 25 cm libres.
            </p>
          </section>

          <button type="button" className="pdc-btn pdc-btn-principal pdc-ancho" data-pdc="ver-final">
            Ver imagen final
          </button>
          <p className="pdc-nota pdc-privacidad">Tus fotos no se suben a ningún lado: todo pasa en tu celular o computadora.</p>
        </aside>
      </div>

      <div className="pdc-modal" data-pdc="modal" hidden>
        <div className="pdc-modal-tarjeta" role="dialog" aria-modal="true" aria-label="Imagen final">
          <div className="pdc-fila pdc-entre">
            <strong>Así quedaría tu pared</strong>
            <button type="button" className="pdc-btn" data-pdc="cerrar-modal">Cerrar</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- es una imagen generada en el navegador (data URL) */}
          <img data-pdc="imagen-final" alt="Foto de la pared con los cuadros ubicados" />
          <p className="pdc-nota">
            Para guardarla: en el celular, mantené apretada la imagen; en la computadora, clic derecho y “Guardar imagen”.
          </p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.pdc{
  --pdc-fg: var(--wsite-text, var(--fo-text, #1d2321));
  --pdc-accent: var(--wsite-primary, var(--fo-accent, #2b6a5f));
  --pdc-on-accent: var(--wsite-bg, var(--fo-on-accent, #ffffff));
  --pdc-line: color-mix(in srgb, var(--pdc-fg) 16%, transparent);
  --pdc-soft: color-mix(in srgb, var(--pdc-fg) 5%, transparent);
  --pdc-stage: color-mix(in srgb, var(--pdc-fg) 9%, transparent);
  --pdc-sel: color-mix(in srgb, var(--pdc-accent) 14%, transparent);
  color: var(--pdc-fg);
}
.pdc *{box-sizing:border-box}
.pdc [hidden]{display:none!important}
.pdc-layout{display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:18px; align-items:start}
.pdc-escena{min-width:0; display:flex; flex-direction:column; gap:10px; position:sticky; top:12px}
.pdc-barra{display:flex; align-items:center; gap:12px; flex-wrap:wrap}
.pdc-seg{display:inline-flex; background:var(--pdc-soft); border:1px solid var(--pdc-line); border-radius:10px; padding:3px}
.pdc-seg button{font:inherit; font-weight:600; font-size:14px; border:0; background:transparent; color:inherit; opacity:.65; padding:7px 12px; border-radius:7px; cursor:pointer}
.pdc-seg button[aria-pressed="true"]{opacity:1; background:var(--pdc-accent); color:var(--pdc-on-accent)}
.pdc-pista{font-size:14px; opacity:.75; flex:1; min-width:200px}
.pdc-fondo{background:var(--pdc-stage); border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; padding:8px}
.pdc-lienzo{display:block; max-width:100%; max-height:calc(100vh - 220px); width:auto; height:auto; touch-action:none; cursor:grab; border-radius:6px}
.pdc-lienzo.pdc-modo-pared{cursor:crosshair}
.pdc-lienzo:focus-visible{outline:3px solid var(--pdc-accent); outline-offset:2px}
.pdc-medidas{display:flex; flex-wrap:wrap; gap:6px 18px; font-size:14px; opacity:.85; font-variant-numeric:tabular-nums}
.pdc-panel{border:1px solid var(--pdc-line); border-radius:14px; padding:6px 16px 16px; display:flex; flex-direction:column; min-width:0}
.pdc-bloque{padding:14px 0; border-bottom:1px solid var(--pdc-line); display:flex; flex-direction:column; gap:10px}
.pdc-bloque h2{font-size:12px; text-transform:uppercase; letter-spacing:.09em; opacity:.7; margin:0; font-weight:700}
.pdc-fila{display:flex; gap:8px; flex-wrap:wrap}
.pdc-entre{justify-content:space-between; align-items:center}
.pdc-btn{font:inherit; font-weight:600; font-size:14px; display:inline-flex; align-items:center; justify-content:center; padding:9px 13px; border-radius:9px;
  border:1px solid var(--pdc-line); background:var(--pdc-soft); color:inherit; cursor:pointer; text-align:center}
.pdc-btn:hover{border-color:var(--pdc-accent)}
.pdc-btn-principal{background:var(--pdc-accent); color:var(--pdc-on-accent); border-color:var(--pdc-accent)}
.pdc-ancho{width:100%; margin-top:12px; padding:12px}
.pdc-btn:focus-visible,.pdc-chip:focus-visible,.pdc-sw:focus-visible,.pdc-thumb:focus-visible,.pdc-seg button:focus-visible{outline:3px solid var(--pdc-accent); outline-offset:2px}
.pdc-campos{display:grid; grid-template-columns:1fr 1fr; gap:8px}
.pdc-campo{display:flex; flex-direction:column; gap:4px; font-size:13px; font-weight:500}
.pdc-unidad{display:flex; align-items:center; gap:6px}
.pdc input[type=number],.pdc select{font:inherit; font-size:15px; color:inherit; background:var(--pdc-soft); border:1px solid var(--pdc-line); border-radius:8px; padding:7px 9px; width:100%; min-width:0; font-variant-numeric:tabular-nums}
.pdc select option{color:#1d2321; background:#fff}
.pdc input[type=range]{width:100%; accent-color:var(--pdc-accent)}
.pdc-check{display:flex; gap:8px; align-items:flex-start; font-size:14px; cursor:pointer}
.pdc-check input{accent-color:var(--pdc-accent); width:17px; height:17px; margin-top:1px; flex:none}
.pdc-chips{display:grid; grid-template-columns:repeat(3,1fr); gap:6px}
.pdc-chip{font:inherit; font-size:12px; font-weight:600; color:inherit; background:var(--pdc-soft); border:1px solid var(--pdc-line); border-radius:9px; padding:8px 4px 6px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px}
.pdc-chip svg{width:44px; height:30px}
.pdc-chip svg rect{fill:currentColor; opacity:.55}
.pdc-chip[aria-pressed="true"]{border-color:var(--pdc-accent); background:var(--pdc-sel)}
.pdc-chip[aria-pressed="true"] svg rect{fill:var(--pdc-accent); opacity:1}
.pdc-swatches{display:grid; grid-template-columns:repeat(4,1fr); gap:6px}
.pdc-sw{font:inherit; font-size:11.5px; font-weight:600; color:inherit; background:transparent; border:1px solid transparent; border-radius:9px; padding:5px 2px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px}
.pdc-sw i{width:34px; height:34px; border-radius:4px; display:block; box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.pdc-sw[aria-pressed="true"]{border-color:var(--pdc-accent); background:var(--pdc-sel)}
.pdc-miniaturas{display:grid; grid-template-columns:repeat(5,1fr); gap:6px}
.pdc-thumb{border:2px solid transparent; padding:0; border-radius:7px; overflow:hidden; cursor:pointer; background:var(--pdc-soft); aspect-ratio:1; max-width:100%}
.pdc-thumb img{width:100%; height:100%; object-fit:cover; display:block}
.pdc-thumb[aria-pressed="true"]{border-color:var(--pdc-accent)}
.pdc-nota{font-size:13px; opacity:.75; margin:0}
.pdc-privacidad{margin-top:8px; text-align:center}
.pdc-tag{font-size:11px; font-weight:700; letter-spacing:.06em; color:var(--pdc-accent); background:var(--pdc-sel); border-radius:5px; padding:2px 6px; margin-left:6px; vertical-align:2px; opacity:1}
.pdc-error{color:#b3261e; font-size:13px; margin:0}
.pdc-modal{position:fixed; inset:0; background:rgba(10,14,12,.72); z-index:60; display:flex; align-items:center; justify-content:center; padding:16px}
.pdc-modal-tarjeta{background:var(--wsite-bg, var(--fo-surface, #fff)); color:var(--pdc-fg); border-radius:14px; padding:14px; max-width:min(1100px,100%); max-height:100%; display:flex; flex-direction:column; gap:10px; overflow:auto}
.pdc-modal-tarjeta img{max-width:100%; max-height:70vh; object-fit:contain; border-radius:8px; align-self:center}
.pdc-historial{gap:4px}
.pdc-icono{padding:6px 11px; font-size:17px; line-height:1}
.pdc-btn:disabled{opacity:.4; cursor:default; border-color:var(--pdc-line)}
.pdc-seg-ancho{display:flex; width:100%}
.pdc-seg-ancho button{flex:1}
.pdc-centro{align-items:center; flex-wrap:nowrap}
.pdc-flex{flex:1; min-width:0}
.pdc select:disabled{opacity:.5}
@media (max-width:900px){
  .pdc-layout{grid-template-columns:minmax(0,1fr)}
  .pdc-escena{position:static}
  .pdc-lienzo{max-height:62vh}
}
`;
