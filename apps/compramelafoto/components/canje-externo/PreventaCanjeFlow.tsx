"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";
import type { PreventaPackSnapshotBenefitV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import {
  buildCanjeSlotPlan,
  currentCanjeSlotIndex,
  photosForCanjeRole,
  type CanjePhotoInput,
  buildRedeemSelections,
  emptyCanjeFill,
  isCanjeComplete,
  packPermiteMismasFotos,
  removeCanjePhotoFromBenefit,
  toggleCanjePhoto,
} from "@/lib/preventa-canjeable/preventa-canje-slots";
import ComboFrames from "./ComboFrames";
import { useMedidasDeFotos } from "./useMedidasDeFotos";
import {
  avisoDeBordes,
  orientacionDeLaFoto,
  TEXTO_DIGITAL,
  textoFormatoCopia,
} from "@/lib/canje-externo/formato-de-la-foto";
import CanjeSteps, { type CanjeStepKey } from "./CanjeSteps";
import PhotoPickGrid from "./PhotoPickGrid";
import CanjeExtrasStep, { type CanjeExtrasConfig } from "./CanjeExtrasStep";
import CanjeLibritoStep, { type CanjeCropEntry } from "./CanjeLibritoStep";
import MiniaturaDelLibrito from "./MiniaturaDelLibrito";
import type { DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import {
  listadoPermiteSumarCursos,
  opcionesDelListado,
  valoresConCursos,
  type CursoDelAlbum,
} from "@/lib/design-v2/listado-cursos";
import {
  aplicarNombreDelAlumno,
  CLAVES_DEL_NOMBRE_DEL_ALUMNO,
  esTextoEditablePorLaFamilia,
} from "@/lib/revision-de-impresion/revision-del-canje";
import { corregirNombresEnValores, type CambioDeNombre } from "@/lib/design-v2/corregir-nombres";
import { tituloDeLaRevision } from "@/lib/revision-de-impresion/autorizacion";
import RevisionDelLibrito from "./RevisionDelLibrito";

type Paso = "intro" | "elegir" | "librito" | "revisar" | "extras" | "listo";

type Props = {
  token: string;
  album: {
    id: number;
    title: string;
    slug: string | null;
    photographerName: string | null;
    scanProtection: boolean;
    selfieSearch: boolean;
    /** La galería vende fotos sueltas: se ofrece comprar más al terminar. */
    sellsSingles: boolean;
  };
  pack: {
    name: string;
    benefits: Array<
      Pick<
        PreventaPackSnapshotBenefitV1,
        | "stableKey"
        | "kind"
        | "selectionMode"
        | "includedQuantity"
        | "requiredPhotoCount"
        | "sortOrder"
        | "name"
        | "includesDigital"
        | "previewImageUrl"
      > & {
        photoInputs?: CanjePhotoInput[] | null;
        /** Medida del producto impreso ("15x21"), si el beneficio es una copia. */
        printSize?: string | null;
      }
    >;
    parentName: string | null;
    studentName: string | null;
    /** El nombre de pila del alumno, ya separado del apellido (sale de la lista del colegio). */
    studentFirstName?: string | null;
  };
  /**
   * Pack cobrado por fuera: no tenemos el email de la familia, así que se lo pedimos antes de
   * confirmar (ahí le llegan los digitales y el comprobante).
   */
  pedirContacto?: boolean;
  /** `faces`: rostros detectados; `null` si la foto todavía no se analizó. */
  photos: Array<{ id: number; sellPrint: boolean; sellDigital: boolean; faces?: number | null }>;
  /** Beneficios con diseño (el librito): se muestran armados antes de confirmar. */
  designs?: Array<{ benefitKey: string; template: DesignTemplatePayload }>;
  /** Textos del diseño: alumno, curso, escuela, listado del curso. */
  designValues?: Record<string, string>;
  /**
   * Fotos y libritos extra que se ofrecen apenas se confirma el canje. `null` si el álbum no
   * está listo para vender (sin productos o sin términos aceptados).
   */
  extras?: CanjeExtrasConfig | null;
  /** Comprador del pack, para el pedido de extras cuando no se le pidieron los datos. */
  comprador?: { nombre: string; email: string; telefono: string };
  /** Pack de prueba del fotógrafo: los extras no se cobran. */
  modoPrueba?: boolean;
  /**
   * El fotógrafo elige por la familia («Elegir de corrido»). Al confirmar no se ofrecen extras:
   * se sigue con el próximo pack de la cola. `grupalDelCurso`: la grupal que ya eligió para este
   * curso, puesta de entrada en el lugar grupal.
   */
  modoFotografo?: { packOrderId: number; grupalDelCurso: number | null };
  /**
   * Los otros cursos del colegio que la familia puede sumar al listado del librito (sólo si la
   * plantilla lo permite). Sin el curso propio.
   */
  cursosParaSumar?: CursoDelAlbum[];
};

function primerNombre(nombre: string | null): string | null {
  return nombre ? nombre.trim().split(/\s+/)[0] : null;
}

function describirGrupo(
  g: { kind: string; units: number; photosPerUnit: number; copias: number },
  conDigital = false
): string {
  const formato = g.kind === "DIGITAL" ? "digital" : conDigital ? "impresa + su digital" : "impresa";
  if (g.copias > 1) return `${g.copias} iguales · ${g.photosPerUnit} fotos distintas · ${formato}`;
  if (g.photosPerUnit > 1) {
    return g.units === 1
      ? `${g.photosPerUnit} fotos distintas · ${formato}`
      : `${g.units} × ${g.photosPerUnit} fotos distintas · ${formato}`;
  }
  return `${g.units} ${g.units === 1 ? "foto" : "fotos"} · ${formato}${g.units === 1 ? "" : "s"}`;
}

/**
 * Canje de un pack de preventa en pasos, con las mismas piezas que el canje de combos
 * cobrados por fuera: casilleros que se llenan, grilla para tocar fotos y un cierre con la
 * descarga. Los casilleros salen de lo que incluye el pack (copia grupal, librito, digitales).
 */
export default function PreventaCanjeFlow({
  token,
  album,
  pack,
  photos,
  pedirContacto = false,
  designs = [],
  designValues = {},
  extras = null,
  comprador,
  modoPrueba = false,
  modoFotografo,
  cursosParaSumar = [],
}: Props) {
  /** Varias carpetas (o libritos) en el mismo pedido: se pregunta si van con las mismas fotos. */
  const permiteMismas = useMemo(() => packPermiteMismasFotos(pack.benefits), [pack.benefits]);
  const [mismasFotos, setMismasFotos] = useState(false);
  const plan = useMemo(
    () => buildCanjeSlotPlan(pack.benefits, { mismasFotos }),
    [pack.benefits, mismasFotos]
  );
  /** Cuántas carpetas compró y cómo se llaman ("2", "Carpeta escolar"), para hacer la pregunta. */
  const repetidas = useMemo(() => {
    const g = buildCanjeSlotPlan(pack.benefits, { mismasFotos: true }).groups.find((x) => x.copias > 1);
    return g ? { cantidad: g.copias, nombre: g.label } : null;
  }, [pack.benefits]);
  const copiasIguales = plan.groups.find((g) => g.copias > 1)?.copias ?? 1;
  const beneficio = useMemo(() => new Map(pack.benefits.map((b) => [b.stableKey, b])), [pack.benefits]);
  const [boceto, setBoceto] = useState<{ url: string; titulo: string } | null>(null);
  const [nombre, setNombre] = useState(pack.parentName ?? "");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [paso, setPaso] = useState<Paso>("intro");
  const [filled, setFilled] = useState<Array<number | null>>(() => emptyCanjeFill(plan));
  /** Cómo acomodó la familia la foto de cada lugar en la vista del librito. */
  const [crops, setCrops] = useState<Record<number, CanjeCropEntry>>({});
  const hayLibrito = designs.length > 0;
  /** El lugar que tocó la familia para llenarlo ahora ("la grupal"). */
  const [destino, setDestino] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoomId, setZoomId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<number[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ pedido: number; downloadUrl: string | null } | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  /** Modo fotógrafo: el próximo toque en la grilla busca al alumno en vez de elegir la foto. */
  const [tocarParaBuscar, setTocarParaBuscar] = useState(false);
  /** Modo fotógrafo: la foto tocada tiene varias caras y hay que elegir cuál es el alumno. */
  const [carasPorElegir, setCarasPorElegir] = useState<{
    photoId: number;
    caras: Array<{ detectionId: number; bbox: { left?: number; top?: number; width?: number; height?: number } }>;
  } | null>(null);
  /** Revisión del librito: lo que corrige la familia, los cursos que suma, sus avisos y la autorización. */
  const [textosEditados, setTextosEditados] = useState<Record<string, string>>({});
  const [cursosElegidos, setCursosElegidos] = useState<string[]>([]);
  const [avisosListado, setAvisosListado] = useState<string[]>([]);
  const [nombresCorregidos, setNombresCorregidos] = useState<CambioDeNombre[]>([]);
  const [autorizado, setAutorizado] = useState(false);
  const { medidas, registrar } = useMedidasDeFotos();

  const total = plan.slots.length;
  const elegidas = filled.filter((x) => x != null) as number[];
  const completo = isCanjeComplete(filled);
  const alumno = pack.studentName;
  // Con el nombre separado no hay que adivinar cuál es el de pila.
  const alumnoCortoDelPack = pack.studentFirstName?.trim() || primerNombre(alumno);
  // Si la familia corrigió el nombre en la revisión, se la saluda con el que escribió.
  const alumnoCorto = textosEditados["student.firstName"]?.trim() || alumnoCortoDelPack;
  const byId = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const thumbUrl = useCallback(
    (id: number) => `/api/photos/${id}/view?albumId=${album.id}&mode=thumb`,
    [album.id]
  );
  const actual = currentCanjeSlotIndex(filled, destino);
  const lugarActual = actual != null ? plan.slots[actual] : null;
  const [verTodasParaGrupal, setVerTodasParaGrupal] = useState(false);
  const facesById = useMemo(() => new Map(photos.map((p) => [p.id, p.faces ?? null])), [photos]);
  const paraElLugar = useMemo(() => {
    const base = (filtro ? photos.filter((p) => filtro.includes(p.id)) : photos).map((p) => p.id);
    if (verTodasParaGrupal) return { ids: base, filtered: false };
    return photosForCanjeRole(base, facesById, lugarActual?.role);
  }, [photos, filtro, facesById, lugarActual?.role, verTodasParaGrupal]);
  const visibles = paraElLugar.ids;
  const hayImpresas = plan.groups.some((g) => g.kind === "PHYSICAL");
  const impresas = plan.slots.filter((s) => s.kind === "PHYSICAL").length;
  const entregaImpresas = `${impresas === 1 ? "La foto impresa te la entrega" : "Las fotos impresas te las entrega"} ${album.photographerName ?? "el fotógrafo"}.`;
  const stepKey: CanjeStepKey =
    paso === "intro" || paso === "elegir" ? "combo" : paso === "revisar" || paso === "librito" ? "extras" : "confirmar";
  const textVariablesDelLibrito = useMemo(
    () => [...new Set(designs.flatMap((d) => d.template.textVariables))],
    [designs]
  );
  const permiteSumarCursos = useMemo(
    () => designs.some((d) => listadoPermiteSumarCursos(d.template.blocks)),
    [designs]
  );
  /** Los textos del librito con lo que corrigió la familia y los cursos sumados, antes de corregir nombres del listado. */
  const valoresSinNombres = useMemo(() => {
    // Nombre y apellido del alumno: la misma cuenta que hace el servidor al confirmar.
    const v = { ...aplicarNombreDelAlumno(designValues, textosEditados).values };
    for (const [k, t] of Object.entries(textosEditados)) {
      if ((CLAVES_DEL_NOMBRE_DEL_ALUMNO as readonly string[]).includes(k)) continue;
      if (esTextoEditablePorLaFamilia(k) && t.trim()) v[k] = t;
    }
    return permiteSumarCursos && cursosElegidos.length ? valoresConCursos(v, cursosParaSumar, cursosElegidos) : v;
  }, [designValues, textosEditados, permiteSumarCursos, cursosElegidos, cursosParaSumar]);
  /** Los textos del librito como se van a imprimir (el servidor hace la misma cuenta al confirmar). */
  const valoresDelLibrito = useMemo(
    () => corregirNombresEnValores(valoresSinNombres, nombresCorregidos).values,
    [valoresSinNombres, nombresCorregidos]
  );
  const productoDelLibrito =
    (designs[0] ? beneficio.get(designs[0].benefitKey)?.name : null)?.trim() || pack.name;
  // La foto grupal que eligió la familia para el librito: con sus caras se avisa si hay más de un curso.
  const carasEnLaGrupal = (() => {
    const claves = new Set(designs.map((d) => d.benefitKey));
    const i = plan.slots.findIndex((s, k) => claves.has(s.benefitKey) && s.role === "group" && filled[k] != null);
    const id = i >= 0 ? filled[i] : null;
    return id != null ? (facesById.get(id) ?? null) : null;
  })();
  /** La foto del primer lugar grupal (la que se recuerda para el curso en modo fotógrafo). */
  const grupalElegida = (() => {
    const i = plan.slots.findIndex((s, k) => s.role === "group" && filled[k] != null);
    return i >= 0 ? filled[i] : null;
  })();
  // Una foto del librito del pack: un librito extra se pide sobre ella.
  const libritoPhotoId = (() => {
    const clave = designs[0]?.benefitKey;
    const grupo = clave ? plan.groups.find((g) => g.benefitKey === clave) : null;
    const id = grupo?.slotIndexes.map((i) => filled[i]).find((x) => x != null);
    return id ?? null;
  })();

  const irA = (p: Paso) => {
    setAviso(null);
    setError(null);
    setPaso(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Elegir "iguales" o "distintas" arma otros lugares: lo elegido antes no sirve. */
  function elegirModo(mismas: boolean) {
    if (mismas !== mismasFotos) {
      setMismasFotos(mismas);
      setFilled(emptyCanjeFill(buildCanjeSlotPlan(pack.benefits, { mismasFotos: mismas })));
      setCrops({});
      setDestino(null);
    }
    irA("elegir");
  }

  function tocar(id: number) {
    setAviso(null);
    const r = toggleCanjePhoto(plan, filled, id, byId.get(id), destino);
    if (r.ok) {
      setFilled(r.filled);
      setDestino(null);
      setVerTodasParaGrupal(false);
      if (r.repetida) setAviso("Sumaste esta foto también en otro formato. Para sacarla de un lugar, tocá la cruz.");
      return;
    }
    setAviso(
      r.reason === "lleno"
        ? `Ya elegiste las ${total} fotos de tu pack. Para cambiar una, sacala tocándola.`
        : "Esta foto no se puede usar en los lugares que te quedan (no se vende en ese formato). Elegí otra."
    );
  }

  /** La cruz de un lugar: la foto sale de ese beneficio, aunque siga en el otro formato. */
  function quitar(benefitKey: string, id: number) {
    setAviso(null);
    setFilled(removeCanjePhotoFromBenefit(plan, filled, benefitKey, id));
  }

  async function buscarConSelfie(file: File) {
    setBuscando(true);
    setAviso(null);
    try {
      try {
        sessionStorage.setItem("faceConsentSession", "1");
      } catch {
        /* sin almacenamiento, la búsqueda sigue */
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/albums/${album.id}/search/face`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos buscar con esa foto.");
      const ids: number[] = (Array.isArray(data?.items) ? data.items : [])
        .map((it: { id: unknown }) => Number(it.id))
        .filter((id: number) => byId.has(id));
      if (ids.length === 0) {
        setAviso("No encontramos fotos con esa cara. Probá con otra foto con buena luz, o mirá la galería completa.");
        setFiltro(null);
      } else {
        setFiltro(ids);
      }
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No pudimos buscar con esa foto.");
    } finally {
      setBuscando(false);
      if (selfieInputRef.current) selfieInputRef.current.value = "";
    }
  }

  /** Modo fotógrafo: las fotos del alumno a partir de una foto (y una cara) que tocó. */
  async function buscarPorFoto(photoId: number, detectionId?: number) {
    setBuscando(true);
    setAviso(null);
    try {
      const q = new URLSearchParams({ albumId: String(album.id), photoId: String(photoId) });
      if (detectionId != null) q.set("detectionId", String(detectionId));
      const res = await fetch(`/api/fotografo/escolar/fotos-del-alumno?${q}`, { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos buscar por esa foto.");
      if (Array.isArray(data?.caras)) {
        setCarasPorElegir({ photoId, caras: data.caras });
        return;
      }
      setCarasPorElegir(null);
      setTocarParaBuscar(false);
      const ids = (Array.isArray(data?.photoIds) ? data.photoIds : []).map(Number).filter((id: number) => byId.has(id));
      if (typeof data?.aviso === "string") setAviso(data.aviso);
      setFiltro(ids.length > 1 ? ids : null);
      if (ids.length <= 1 && !data?.aviso) setAviso("No encontramos otras fotos con esa cara. Probá con otra foto.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No pudimos buscar por esa foto.");
    } finally {
      setBuscando(false);
    }
  }

  async function confirmar() {
    if (enviando || !completo) return;
    setError(null);
    if (hayLibrito && !autorizado) {
      return setError("Para confirmar, tildá que revisaste todos los datos y autorizás la impresión.");
    }
    if (pedirContacto) {
      if (!nombre.trim()) return setError("Escribí tu nombre.");
      const errEmail = getCheckoutEmailValidationError(email);
      if (errEmail) return setError(errEmail);
      const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
      if (!telefono.trim() || !isValidPhoneForPurchase(telefono)) {
        return setError("Escribí tu WhatsApp con código de área (por ejemplo 341 555-1234).");
      }
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/public/pack/${encodeURIComponent(token)}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selections: buildRedeemSelections(
            plan,
            filled,
            Object.fromEntries(
              Object.entries(crops)
                .filter(([i, c]) => filled[Number(i)] === c.photoId)
                .map(([i, c]) => [Number(i), c.crop])
            )
          ),
          ...(pedirContacto
            ? { contacto: { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() } }
            : {}),
          ...(modoFotografo
            ? { comoFotografo: true, ...(grupalElegida != null ? { grupalElegida } : {}) }
            : {}),
          ...(hayLibrito
            ? {
                revision: {
                  autorizado: true,
                  textos: Object.fromEntries(
                    Object.entries(textosEditados).filter(([k, v]) => esTextoEditablePorLaFamilia(k) && v.trim())
                  ),
                  cursos: permiteSumarCursos ? cursosElegidos : [],
                  avisos: avisosListado,
                  nombres: nombresCorregidos,
                },
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos confirmar el canje.");
      if (modoFotografo) {
        // Listo este pack: «Elegir de corrido» abre el próximo.
        window.location.assign(`/fotografo/escuelas/elegir?hecho=${modoFotografo.packOrderId}`);
        return;
      }
      setResultado({
        pedido: Number(data.redemptionOrderId),
        downloadUrl: typeof data.downloadUrl === "string" ? data.downloadUrl : null,
      });
      // Apenas queda confirmado el canje se ofrecen extras: la familia tiene todas las fotos
      // de su hijo a la vista y es cuando más ganas tiene de sumar.
      irA(extras ? "extras" : "listo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos confirmar el canje.");
    } finally {
      setEnviando(false);
    }
  }

  // Los beneficios con diseño (el librito) se muestran como miniatura del diseño real.
  const disenoPorBeneficio = new Map(designs.map((d) => [d.benefitKey, d.template]));
  /** En qué formato recibe la familia cada foto elegida (no aplica al librito: ahí manda el diseño). */
  const formatoDe = (benefitKey: string, kind: string, photoId: number): string => {
    if (kind === "DIGITAL") return TEXTO_DIGITAL;
    const m = medidas.get(photoId);
    return textoFormatoCopia(beneficio.get(benefitKey)?.printSize, orientacionDeLaFoto(m?.ancho, m?.alto));
  };
  // Una copia de cámara (3:2) en papel 15x21 no calza justo: se avisa una vez, sin alarmar.
  const avisoBordes = plan.groups
    .filter((g) => g.kind === "PHYSICAL" && !disenoPorBeneficio.has(g.benefitKey))
    .flatMap((g) =>
      g.slotIndexes.map((i) => {
        const id = filled[i];
        const m = id != null ? medidas.get(id) : undefined;
        return avisoDeBordes(beneficio.get(g.benefitKey)?.printSize, m?.ancho, m?.alto);
      })
    )
    .find((x) => x != null);
  const casilleros = (size: "lg" | "md" | "sm", editable: boolean) => (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-4">
      {plan.groups.map((g) => (
        <div key={g.benefitKey} className="text-center">
          {disenoPorBeneficio.get(g.benefitKey) ? (
            <MiniaturaDelLibrito
              template={disenoPorBeneficio.get(g.benefitKey)!}
              slotIndexes={g.slotIndexes}
              units={g.units}
              photosPerUnit={g.photosPerUnit}
              labels={plan.slots.map((s) => s.label ?? "Foto")}
              filled={filled}
              activePlace={editable ? actual : null}
              thumbUrl={thumbUrl}
              onPickEmpty={
                editable
                  ? (place) => {
                      setDestino(place);
                      setVerTodasParaGrupal(false);
                    }
                  : undefined
              }
              onRemove={editable ? (id) => quitar(g.benefitKey, id) : undefined}
              alto={size === "sm" ? 130 : size === "md" ? 200 : 260}
              values={valoresDelLibrito}
            />
          ) : (
          <ComboFrames
            slots={g.slotIndexes.length}
            photoIds={g.slotIndexes.map((i) => filled[i]) as number[]}
            labels={g.slotIndexes.map((i) => plan.slots[i].label)}
            activeIndex={editable && actual != null ? g.slotIndexes.indexOf(actual) : -1}
            onPickEmpty={
              editable
                ? (pos) => {
                    setDestino(g.slotIndexes[pos] ?? null);
                    setVerTodasParaGrupal(false);
                  }
                : undefined
            }
            thumbUrl={thumbUrl}
            onRemove={editable ? (id) => quitar(g.benefitKey, id) : undefined}
            size={size}
            onImgLoad={registrar}
            caption={size === "lg" ? (id) => formatoDe(g.benefitKey, g.kind, id) : undefined}
          />
          )}
          <p className="m-0 mt-2 text-sm font-medium text-[#1f2328]">{g.label}</p>
          <p className="m-0 text-xs text-[#6b6f76]">
            {describirGrupo(g, beneficio.get(g.benefitKey)?.includesDigital === true)}
          </p>
          {beneficio.get(g.benefitKey)?.previewImageUrl ? (
            <button
              type="button"
              onClick={() =>
                setBoceto({ url: beneficio.get(g.benefitKey)!.previewImageUrl!, titulo: g.label })
              }
              className="mx-auto mt-2 block rounded-lg border border-[#e7e1da] bg-white p-1 hover:border-[#c27b3d]"
              aria-label={`Ver cómo queda: ${g.label}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={beneficio.get(g.benefitKey)!.previewImageUrl!}
                alt=""
                className={`${size === "sm" ? "h-10" : "h-20"} w-auto rounded object-contain`}
              />
              <span className="block text-[11px] text-[#a8652e] underline">Ver cómo queda</span>
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );

  const viewerPhotos = useMemo(
    () =>
      visibles.map((id) => ({
        id: String(id),
        src: `/api/photos/${id}/view?mode=preview&albumId=${album.id}`,
        alt: "Foto del álbum",
        selected: filled.includes(id),
      })),
    [visibles, album.id, filled]
  );

  const galeriaHref = album.slug ? `/album/${album.slug}` : `/a/${album.id}`;

  return (
    <div className="min-h-screen bg-[#f7f5f2] pb-36">
      <header className="border-b border-[#e7e1da] bg-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4">
          <p className="m-0 text-sm text-[#6b6f76]">
            {album.title}
            {album.photographerName ? ` — ${album.photographerName}` : ""}
          </p>
          <CanjeSteps current={stepKey} labels={{ combo: "Tu pack", extras: "Revisá", confirmar: "Listo" }} />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {paso === "intro" ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            <h1 className="m-0 text-2xl font-semibold text-[#1f2328] sm:text-3xl">
              {pack.parentName ? `Hola, ${primerNombre(pack.parentName)}` : "Hola"}
            </h1>
            <p className="m-0 mt-2 text-lg text-[#2f7d5b]">
              {alumno ? `El pack de ${alumno} ya está pago` : "Tu pack ya está pago"}
            </p>
            <p className="m-0 mt-1 text-sm text-[#6b6f76]">{pack.name}</p>
            <div className="my-7">{casilleros("md", false)}</div>
            <p className="m-0 text-left text-[15px] leading-relaxed text-[#3d4148]">
              <strong>
                {permiteMismas && repetidas
                  ? "Elegí las fotos de tu pack."
                  : `Elegí ${total === 1 ? "la foto" : `las ${total} fotos`} de tu pack.`}
              </strong>{" "}
              {total === 1 ? "Ya está paga: no vas a pagar nada por ella." : "Ya están pagas: no vas a pagar nada por ellas."}
              {hayImpresas ? ` ${entregaImpresas}` : ""}
            </p>
            {permiteMismas && repetidas ? (
              <div className="mt-8 border-t border-[#efeae4] pt-6">
                <p className="m-0 text-base font-semibold text-[#1f2328]">
                  Compraste {repetidas.cantidad} unidades de «{repetidas.nombre}». ¿Van todas con las mismas fotos?
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => elegirModo(true)}
                    className="min-h-12 rounded-xl bg-[#c27b3d] px-6 text-base font-semibold text-white hover:bg-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]"
                  >
                    Sí, todas con las mismas fotos
                  </button>
                  <button
                    type="button"
                    onClick={() => elegirModo(false)}
                    className="min-h-12 rounded-xl border-2 border-[#c27b3d] px-6 text-base font-semibold text-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]"
                  >
                    No, cada una con otras fotos
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => irA("elegir")}
                className="mt-8 min-h-12 w-full rounded-xl bg-[#c27b3d] px-6 text-base font-semibold text-white hover:bg-[#a8652e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] sm:w-auto"
              >
                {total === 1 ? "Elegir mi foto" : `Elegir mis ${total} fotos`}
              </button>
            )}
          </section>
        ) : null}

        {paso === "elegir" ? (
          <section>
            <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[#e7e1da] bg-[#f7f5f2]/95 px-4 py-3 backdrop-blur">
              <h1 className="m-0 text-lg font-semibold text-[#1f2328]">
                Elegí {total === 1 ? "la foto" : `las ${total} fotos`} de tu pack
              </h1>
              {copiasIguales > 1 ? (
                <p className="m-0 text-sm text-[#4b4f56]">
                  Estas fotos van en las {copiasIguales} unidades de tu pack.
                </p>
              ) : null}
              <p className="m-0 mb-3 text-sm text-[#2f7d5b]">
                {completo
                  ? total === 1
                    ? "¡Listo! Ya está elegida"
                    : "¡Listo! Ya están todas"
                  : `${elegidas.length} de ${total} elegidas · te ${total - elegidas.length === 1 ? "falta" : "faltan"} ${total - elegidas.length}`}
              </p>
              {casilleros("sm", true)}
              {lugarActual?.label && !completo ? (
                <p className="m-0 mt-3 text-center text-sm text-[#1f2328]">
                  Ahora elegí: <strong>{lugarActual.label}</strong>
                  {paraElLugar.filtered ? (
                    <>
                      {" "}
                      · te mostramos las fotos grupales.{" "}
                      <button
                        type="button"
                        className="font-medium text-[#a8652e] underline"
                        onClick={() => setVerTodasParaGrupal(true)}
                      >
                        Ver todas
                      </button>
                    </>
                  ) : null}
                  <span className="block text-xs text-[#6b6f76]">Tocá otro lugar vacío para elegir esa foto primero.</span>
                </p>
              ) : null}
            </div>
            {modoFotografo ? (
              <div className="mb-4 rounded-xl border border-[#cfe3d8] bg-[#f3f9f5] p-4">
                {filtro ? (
                  <p className="m-0 text-sm text-[#1f2328]">
                    Mostrando {filtro.length} fotos donde aparece {alumnoCorto ?? "el alumno"}.{" "}
                    <button type="button" className="font-medium text-[#a8652e] underline" onClick={() => setFiltro(null)}>
                      Ver todas
                    </button>{" "}
                    ·{" "}
                    <button type="button" className="font-medium text-[#a8652e] underline" onClick={() => setTocarParaBuscar(true)}>
                      Buscar con otra foto
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="m-0 text-sm text-[#1f2328]">
                      {tocarParaBuscar
                        ? `Tocá una foto donde aparezca ${alumnoCorto ?? "el alumno"}.`
                        : `Buscá a ${alumnoCorto ?? "el alumno"}: tocá una foto suya y te mostramos todas en las que aparece.`}
                    </p>
                    <button
                      type="button"
                      disabled={buscando}
                      onClick={() => {
                        setTocarParaBuscar((v) => !v);
                        setCarasPorElegir(null);
                      }}
                      className="min-h-11 shrink-0 rounded-lg border border-[#1f5b3f] px-4 text-sm font-semibold text-[#1f5b3f] disabled:opacity-60"
                    >
                      {buscando ? "Buscando…" : tocarParaBuscar ? "Cancelar" : "Buscar al alumno"}
                    </button>
                  </div>
                )}
                {carasPorElegir ? (
                  <div className="mt-3">
                    <p className="m-0 mb-2 text-sm text-[#1f2328]">Hay varias caras: tocá la de {alumnoCorto ?? "el alumno"}.</p>
                    <div className="relative inline-block max-w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/photos/${carasPorElegir.photoId}/view?mode=preview&albumId=${album.id}`}
                        alt="Foto para elegir la cara"
                        className="block max-h-[60vh] max-w-full rounded-lg"
                      />
                      {carasPorElegir.caras.map((c) => (
                        <button
                          key={c.detectionId}
                          type="button"
                          aria-label="Es esta cara"
                          disabled={buscando}
                          onClick={() => void buscarPorFoto(carasPorElegir.photoId, c.detectionId)}
                          className="absolute rounded-md border-2 border-white shadow-[0_0_0_2px_#1f5b3f] hover:bg-white/20"
                          style={{
                            left: `${(c.bbox.left ?? 0) * 100}%`,
                            top: `${(c.bbox.top ?? 0) * 100}%`,
                            width: `${(c.bbox.width ?? 0) * 100}%`,
                            height: `${(c.bbox.height ?? 0) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : album.selfieSearch ? (
              <div className="mb-4 rounded-xl border border-[#e7e1da] bg-white p-4">
                {filtro ? (
                  <p className="m-0 text-sm text-[#1f2328]">
                    Mostrando {filtro.length} {filtro.length === 1 ? "foto" : "fotos"}
                    {alumnoCorto ? ` donde aparece ${alumnoCorto}` : " de la búsqueda"}.{" "}
                    <button type="button" className="font-medium text-[#a8652e] underline" onClick={() => setFiltro(null)}>
                      Ver todas las fotos
                    </button>
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="m-0 text-sm text-[#4b4f56]">
                      ¿Son muchas fotos? Cargá una foto de la cara de {alumnoCorto ?? "tu hija o hijo"} y te
                      mostramos sólo las suyas. La usamos sólo para buscar.
                    </p>
                    <button
                      type="button"
                      disabled={buscando}
                      onClick={() => selfieInputRef.current?.click()}
                      className="min-h-11 shrink-0 rounded-lg border border-[#c27b3d] px-4 text-sm font-semibold text-[#a8652e] disabled:opacity-60"
                    >
                      {buscando ? "Buscando…" : "Buscar con una foto"}
                    </button>
                  </div>
                )}
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void buscarConSelfie(f);
                  }}
                />
              </div>
            ) : null}
            <PhotoPickGrid
              photoIds={visibles}
              selected={elegidas}
              onToggle={(id) => (modoFotografo && tocarParaBuscar ? void buscarPorFoto(id) : tocar(id))}
              onZoom={setZoomId}
              thumbUrl={thumbUrl}
              full={completo}
              accent="combo"
              onImgLoad={registrar}
            />
          </section>
        ) : null}

        {paso === "librito" ? (
          <CanjeLibritoStep
            plan={plan}
            filled={filled}
            crops={crops}
            onChange={(f, c) => {
              setFilled(f);
              setCrops(c);
            }}
            designs={designs}
            values={valoresDelLibrito}
            photoUrl={(id) => `/api/photos/${id}/view?mode=preview&albumId=${album.id}`}
            photos={byId}
            studentName={alumnoCorto}
          />
        ) : null}

        {paso === "revisar" ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            {casilleros("lg", false)}
            {avisoBordes ? <p className="m-0 mt-4 text-xs text-[#6b6f76]">{avisoBordes}</p> : null}
            <h1 className="m-0 mt-6 text-2xl font-semibold text-[#1f2328]">
              {hayLibrito ? tituloDeLaRevision(productoDelLibrito) : total === 1 ? "¿Es esta?" : "¿Son estas?"}
            </h1>
            <p className="m-0 mt-2 text-[#4b4f56]">
              Al confirmar {total === 1 ? "queda pedida y no se puede cambiar" : "quedan pedidas y no se pueden cambiar"}.
              No vas a pagar nada.
            </p>
            {copiasIguales > 1 ? (
              <p className="m-0 mt-2 font-medium text-[#2f7d5b]">
                Recibís {copiasIguales} unidades iguales, con estas fotos.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => irA("elegir")}
              className="mt-5 text-sm font-medium text-[#6b6f76] underline"
            >
              Cambiar fotos
            </button>
            {hayLibrito ? (
              <div className="mt-7 border-t border-[#efeae4] pt-6">
                <RevisionDelLibrito
                  opcionesDelListado={designs[0] ? opcionesDelListado(designs[0].template.blocks) : undefined}
                  textVariables={textVariablesDelLibrito}
                  valores={valoresDelLibrito}
                  onCambiarTexto={(k, v) => {
                    setTextosEditados((prev) => ({ ...prev, [k]: v }));
                    setAutorizado(false);
                  }}
                  permiteSumar={permiteSumarCursos}
                  cursosParaSumar={cursosParaSumar}
                  cursosElegidos={cursosElegidos}
                  onCursos={(c) => {
                    setCursosElegidos(c);
                    setAutorizado(false);
                  }}
                  carasEnLaGrupal={carasEnLaGrupal}
                  avisos={avisosListado}
                  onAvisos={setAvisosListado}
                  fotografo={album.photographerName}
                  autorizado={autorizado}
                  onAutorizar={setAutorizado}
                  valoresSinCorregir={valoresSinNombres}
                  textosEditados={textosEditados}
                  nombresCorregidos={nombresCorregidos}
                  onNombresCorregidos={(c) => {
                    setNombresCorregidos(c);
                    setAutorizado(false);
                  }}
                />
              </div>
            ) : null}
            {pedirContacto ? (
              <div className="mt-7 space-y-4 border-t border-[#efeae4] pt-6 text-left">
                <h2 className="m-0 text-lg font-semibold text-[#1f2328]">Tus datos</h2>
                <p className="m-0 text-sm text-[#6b6f76]">
                  Al email te mandamos los archivos digitales. El WhatsApp es para coordinar la entrega de lo impreso.
                </p>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[#1f2328]">Nombre y apellido</span>
                  <input
                    className="min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[#1f2328]">Email</span>
                  <input
                    className="min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[#1f2328]">WhatsApp</span>
                  <input
                    className="min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none"
                    type="tel"
                    autoComplete="tel"
                    placeholder="341 555-1234"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </section>
        ) : null}

        {paso === "extras" && extras ? (
          <CanjeExtrasStep
            albumId={album.id}
            photos={photos}
            usadasEnPack={elegidas}
            libritoPhotoId={libritoPhotoId}
            config={extras}
            comprador={
              pedirContacto
                ? { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() }
                : (comprador ?? { nombre: nombre.trim(), email: "", telefono: "" })
            }
            alumnoCorto={alumnoCorto}
            modoPrueba={modoPrueba}
            thumbUrl={thumbUrl}
            onTerminar={() => irA("listo")}
          />
        ) : null}

        {paso === "listo" && resultado ? (
          <section className="mx-auto max-w-xl rounded-2xl bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-10">
            {casilleros("lg", false)}
            <h1 className="m-0 mt-6 text-2xl font-semibold text-[#1f2328]">¡Listo! Tu pack quedó canjeado</h1>
            <p className="m-0 mt-1 text-sm text-[#6b6f76]">Pedido #{resultado.pedido}</p>
            {resultado.downloadUrl ? (
              <>
                <a
                  href={resultado.downloadUrl}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2f7d5b] px-6 text-base font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f7d5b] sm:w-auto"
                >
                  Descargar mis fotos digitales
                </a>
                <p className="m-0 mt-3 text-sm text-[#4b4f56]">
                  Si todavía se están preparando, esa página te avisa y se actualiza sola. También te llega el
                  link por correo{pedirContacto && email.trim() ? ` a ${email.trim()}` : ""}.
                </p>
              </>
            ) : null}
            {hayImpresas ? (
              <p className="m-0 mt-5 text-[15px] text-[#3d4148]">{entregaImpresas}</p>
            ) : null}
            {album.sellsSingles ? (
              <div className="mt-7 border-t border-[#efeae4] pt-6">
                <p className="m-0 text-[15px] text-[#3d4148]">¿Querés más fotos? Las podés comprar en la galería.</p>
                <a
                  href={galeriaHref}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-[#c27b3d] px-5 text-sm font-semibold text-[#a8652e]"
                >
                  Comprar más fotos
                </a>
              </div>
            ) : (
              <a href={galeriaHref} className="mt-6 inline-block text-sm font-medium text-[#a8652e] underline">
                Volver a la galería
              </a>
            )}
          </section>
        ) : null}

        {aviso ? (
          <p role="status" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#fff4e5] px-4 py-3 text-sm text-[#7a4a12]">
            {aviso}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mx-auto mt-4 max-w-xl rounded-lg bg-[#fdecec] px-4 py-3 text-sm text-[#9b1c1c]">
            {error}
          </p>
        ) : null}
      </main>

      {paso === "elegir" || paso === "librito" || paso === "revisar" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e7e1da] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() =>
                irA(paso === "elegir" ? "intro" : paso === "revisar" && hayLibrito ? "librito" : "elegir")
              }
              className="min-h-12 px-2 text-sm font-medium text-[#6b6f76] underline"
            >
              Volver
            </button>
            {paso === "elegir" ? (
              <button
                type="button"
                disabled={!completo}
                onClick={() => irA(hayLibrito ? "librito" : "revisar")}
                className="min-h-12 flex-1 rounded-xl bg-[#2f7d5b] px-5 text-base font-semibold text-white disabled:bg-[#c9c3bc] sm:flex-none"
              >
                {completo
                  ? total === 1
                    ? "Listo, es esta"
                    : `Listo, son mis ${total} fotos`
                  : `Elegí ${total - elegidas.length} más`}
              </button>
            ) : paso === "librito" ? (
              <button
                type="button"
                onClick={() => irA("revisar")}
                className="min-h-12 flex-1 rounded-xl bg-[#2f7d5b] px-5 text-base font-semibold text-white sm:flex-none"
              >
                Me gusta así, seguir
              </button>
            ) : (
              <button
                type="button"
                disabled={enviando || (hayLibrito && !autorizado)}
                onClick={() => void confirmar()}
                className="min-h-12 flex-1 rounded-xl bg-[#c27b3d] px-5 text-base font-semibold text-white hover:bg-[#a8652e] disabled:bg-[#c9c3bc] sm:flex-none"
              >
                {enviando ? "Confirmando…" : "Confirmar mi pack"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {boceto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Cómo queda: ${boceto.titulo}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
          onClick={() => setBoceto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={boceto.url} alt={`Boceto: ${boceto.titulo}`} className="max-h-[80vh] max-w-full rounded-lg bg-white object-contain" />
          <p className="m-0 mt-3 text-center text-sm text-white">
            {boceto.titulo} · boceto ilustrativo. Tocá en cualquier lugar para cerrar.
          </p>
        </div>
      ) : null}

      {zoomId != null ? (
        <PhotoSlideViewer
          photos={viewerPhotos}
          initialIndex={Math.max(0, visibles.indexOf(zoomId))}
          onClose={() => setZoomId(null)}
          onPhotoSelect={(id) => tocar(Number(id))}
          protectUnpurchased={album.scanProtection}
        />
      ) : null}
    </div>
  );
}
