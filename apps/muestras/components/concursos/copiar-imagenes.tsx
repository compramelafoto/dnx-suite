"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { copiarImagenesDelConcurso, reintentarImagenes } from "@/lib/concursos/acciones";
import { alerta, botonChico, nota } from "./estilos";

type Props = { activityId: string; total: number; faltan: number; fallaron: number };

/**
 * Copia las imágenes del concurso por tandas (D12): mientras falten, pide una tanda tras otra y
 * muestra el avance. Lo copiado no se pierde: se puede cerrar la página y seguir la próxima vez.
 */
export function CopiarImagenes({ activityId, total, faltan: faltanAlEntrar, fallaron: fallaronAlEntrar }: Props) {
  const router = useRouter();
  const [faltan, setFaltan] = useState(faltanAlEntrar);
  const [fallaron, setFallaron] = useState(fallaronAlEntrar);
  const [copiando, setCopiando] = useState(faltanAlEntrar > 0);
  const [error, setError] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const corriendo = useRef(false);

  useEffect(() => {
    if (!copiando || corriendo.current) return;
    corriendo.current = true;
    let vivo = true;
    (async () => {
      try {
        for (;;) {
          const r = await copiarImagenesDelConcurso(activityId);
          if (!vivo) return;
          if (!r.ok) {
            setError(r.errores.join(" "));
            break;
          }
          setFaltan(r.faltan);
          setFallaron(r.fallaron);
          if (r.avisos?.length) setAvisos(r.avisos);
          // Sin avance (todas fallaron o cambiaron en el medio): no insiste en bucle.
          if (r.faltan === 0 || r.copiadas === 0) break;
        }
      } catch {
        if (vivo) setError("Se cortó la copia. Recargá la página para seguir.");
      } finally {
        corriendo.current = false;
        if (vivo) {
          setCopiando(false);
          router.refresh();
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [activityId, copiando, router]);

  const reintentar = async () => {
    setError(null);
    const r = await reintentarImagenes(activityId);
    if (!r.ok) return setError(r.errores.join(" "));
    setFaltan((f) => f + fallaron);
    setFallaron(0);
    setCopiando(true);
  };

  if (faltan === 0 && fallaron === 0 && !error && !avisos.length) return null;
  const listas = Math.max(0, total - faltan - fallaron);
  return (
    <section aria-live="polite" className="space-y-2 rounded-[2px] border border-[var(--mf-line)] p-4">
      {copiando ? (
        <>
          <p className="text-[15px]">Copiando imágenes: {listas} de {total}</p>
          <p className={nota}>Podés cerrar esta página: seguimos donde quedó la próxima vez que entres.</p>
        </>
      ) : faltan > 0 ? (
        <p className="text-[15px]">Faltan copiar {faltan} {faltan === 1 ? "imagen" : "imágenes"}.{" "}
          <button type="button" className={botonChico} onClick={() => setCopiando(true)}>Seguir copiando</button>
        </p>
      ) : null}
      {fallaron > 0 && !copiando ? (
        <p className="text-[15px]">
          {fallaron === 1 ? "Una imagen no se pudo traer" : `${fallaron} imágenes no se pudieron traer`} de FotoRank.{" "}
          <button type="button" className={botonChico} onClick={reintentar}>Reintentar</button>
        </p>
      ) : null}
      {avisos.map((a) => <p key={a} className={alerta}>{a}</p>)}
      {error ? <p role="alert" className={alerta}>{error}</p> : null}
    </section>
  );
}
