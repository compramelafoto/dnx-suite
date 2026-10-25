"use client";

import { useActionState } from "react";
import { editarPortfolioAction, subirFotoPortfolioAction, type EstadoTelegramConfig } from "../../actions";
import { Mensaje } from "../../telegram-form";

const INICIAL: EstadoTelegramConfig = { error: null };

/** Un botón que manda un cambio del portfolio (agregar, quitar, mover) con sus campos ocultos. */
export function CambioBoton({
  categoriaId,
  campos,
  texto,
  etiqueta,
  primario = false,
}: {
  categoriaId: string;
  campos: Record<string, string>;
  texto: string;
  etiqueta?: string;
  primario?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(editarPortfolioAction, INICIAL);
  return (
    <form action={enviar} className="inline-flex flex-col gap-1">
      <input type="hidden" name="categoriaId" value={categoriaId} />
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={enviando} aria-label={etiqueta ?? texto} className={`fo-btn text-sm ${primario ? "fo-btn-primary" : "fo-btn-secondary"}`}>
        {enviando ? "…" : texto}
      </button>
      {estado.error ? <Mensaje estado={estado} /> : null}
    </form>
  );
}

/** Agregar una galería entera (sus primeras N fotos). */
export function AgregarGaleriaForm({ categoriaId, galerias }: { categoriaId: string; galerias: { id: string; etiqueta: string }[] }) {
  const [estado, enviar, enviando] = useActionState(editarPortfolioAction, INICIAL);
  return (
    <form action={enviar} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="categoriaId" value={categoriaId} />
      <input type="hidden" name="accion" value="galeria" />
      <div className="fo-field-stack min-w-[14rem] flex-1">
        <label className="fo-label" htmlFor="pf-galeria">Galería</label>
        <select id="pf-galeria" name="galeriaId" required className="fo-input">
          {galerias.map((g) => (
            <option key={g.id} value={g.id}>{g.etiqueta}</option>
          ))}
        </select>
      </div>
      <div className="fo-field-stack w-28">
        <label className="fo-label" htmlFor="pf-cantidad">Cuántas fotos</label>
        <input id="pf-cantidad" name="cantidad" type="number" min={1} max={24} defaultValue={8} className="fo-input" />
      </div>
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary">{enviando ? "Agregando…" : "Agregar la galería"}</button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function SubirFotoForm({ categoriaId }: { categoriaId: string }) {
  const [estado, enviar, enviando] = useActionState(subirFotoPortfolioAction, INICIAL);
  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="categoriaId" value={categoriaId} />
      <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" required className="block text-sm" aria-label="Foto para el portfolio" />
      <p className="text-xs text-[var(--fo-muted)]">JPG, PNG o WebP de hasta 3,5 MB. Exportala liviana: con 2000 px del lado más largo alcanza para el celular.</p>
      <Mensaje estado={estado} />
      <button type="submit" disabled={enviando} className="fo-btn fo-btn-primary">{enviando ? "Subiendo…" : "Subir la foto"}</button>
    </form>
  );
}
