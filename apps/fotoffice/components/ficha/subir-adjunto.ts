import { confirmarSubidaAction, pedirSubidaAction } from "@/app/actions/ficha";
import { ERROR_TAMANO, ERROR_TIPO, ERROR_VACIO, TAMANO_MAXIMO, esTipoPermitido } from "@/lib/ficha/adjuntos-reglas";
import { tipoDeArchivo } from "@/lib/ficha/formato";
import type { PersonaFicha, Resultado } from "./tipos";

/**
 * PUT directo al almacenamiento con el enlace firmado, informando el progreso. Se usa
 * XMLHttpRequest porque `fetch` no informa cuánto se subió. El `content-type` tiene que ser el
 * mismo que se declaró al pedir el permiso: es parte de la firma.
 */
function putConProgreso(url: string, archivo: File, tipo: string, alAvanzar: (porcentaje: number) => void): Promise<boolean> {
  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", tipo);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) alAvanzar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolver(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolver(false);
    xhr.onabort = () => resolver(false);
    xhr.send(archivo);
  });
}

/** Revisión previa en el navegador, con las mismas reglas que aplica el servidor. */
export function revisarArchivo(archivo: File): string | null {
  const tipo = tipoDeArchivo(archivo.name, archivo.type);
  if (!esTipoPermitido(tipo)) return ERROR_TIPO;
  if (archivo.size === 0) return ERROR_VACIO;
  if (archivo.size > TAMANO_MAXIMO) return ERROR_TAMANO;
  return null;
}

/** Cómo se pide y se confirma una subida: la de las fichas de personas o la de otro registro (un proyecto). */
export type CanalDeSubida = {
  pedir: (archivo: { nombre: string; tipo: string; tamano: number }) => Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }>;
  confirmar: (id: string) => Promise<Resultado>;
};

const canalDePersona = (persona: PersonaFicha): CanalDeSubida => ({
  pedir: (archivo) => pedirSubidaAction(persona, archivo),
  confirmar: (id) => confirmarSubidaAction(persona, id),
});

/**
 * Un archivo de punta a punta: pedir permiso (el servidor valida y reserva) → PUT directo →
 * confirmar (el servidor verifica que el objeto llegó y su tamaño real).
 */
export async function subirAdjunto(
  persona: PersonaFicha,
  archivo: File,
  alAvanzar: (porcentaje: number) => void,
): Promise<Resultado> {
  const r = await subirAdjuntoConId(persona, archivo, alAvanzar);
  return r.ok ? { ok: true } : r;
}

/**
 * Igual que `subirAdjunto`, pero devuelve el id del adjunto ya confirmado: lo usa el comprobante
 * de un cobro (el adjunto queda en la ficha del contacto y el cobro lo referencia).
 */
export async function subirAdjuntoConId(
  persona: PersonaFicha,
  archivo: File,
  alAvanzar: (porcentaje: number) => void,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return subirPorCanal(canalDePersona(persona), archivo, alAvanzar);
}

/** Lo mismo, con el canal que se le pase (los adjuntos de un proyecto). */
export async function subirPorCanal(
  canal: CanalDeSubida,
  archivo: File,
  alAvanzar: (porcentaje: number) => void,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const problema = revisarArchivo(archivo);
  if (problema) return { ok: false, error: problema };
  const tipo = tipoDeArchivo(archivo.name, archivo.type);
  const permiso = await canal.pedir({ nombre: archivo.name, tipo, tamano: archivo.size });
  if (!permiso.ok) return permiso;
  const subio = await putConProgreso(permiso.url, archivo, tipo, alAvanzar);
  if (!subio) return { ok: false, error: "La subida no se completó. Probá de nuevo." };
  const confirmado = await canal.confirmar(permiso.id);
  return confirmado.ok ? { ok: true, id: permiso.id } : confirmado;
}
