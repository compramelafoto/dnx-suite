"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ModeloLibrito } from "./modelo-librito";

/**
 * La escena 3D del librito. Recibe las páginas ya dibujadas (un canvas por página) y arma:
 * - **plegado**: dos mitades con bisagra en el doblez. La mitad móvil lleva la tapa por fuera y
 *   el interior izquierdo por dentro; la fija, la contratapa y el interior derecho.
 * - **hojas**: una hoja por vez, con frente y dorso.
 *
 * Las caras de una caja de three.js van en el orden +x, -x, +y, -y, +z (frente), -z (dorso). La
 * cara -z ya se ve derecha desde atrás, así que el dorso no hay que espejarlo.
 */

const FONDO = "#f7f3ee";
const PAPEL = "#fbfaf7";
/** Grosor del papel (el alto de la hoja vale 1). */
const GROSOR = 0.006;
/** Ángulo de la tapa con el librito abierto: un poco levantada, como una tarjeta parada. */
const ABIERTO = 0.14;

type Props = {
  modelo: ModeloLibrito;
  paginas: HTMLCanvasElement[];
  /** Plegado: si está abierto. */
  abierto: boolean;
  /** Plegado y cerrado: se muestra de espaldas, con la contratapa al frente. */
  deEspaldas?: boolean;
  /** Hojas: cuál se ve y si está dada vuelta. */
  hoja: number;
  volteada: boolean;
  /** Giro de la vista en grados (de a 90°), igual que el botón "Girar" de la vista plana. */
  giro: number;
};

/** Arma una textura a partir de una página; `offsetX`/`repeatX` toman sólo una mitad. */
function useTexturas() {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const aniso = gl.capabilities.getMaxAnisotropy();
    const mk = (canvas: HTMLCanvasElement | undefined, offsetX = 0, repeatX = 1) => {
      if (!canvas) return null;
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      t.offset.set(offsetX, 0);
      t.repeat.set(repeatX, 1);
      t.needsUpdate = true;
      return t;
    };
    return { mk };
  }, [gl]);
}

function materialPapel(map: THREE.Texture | null) {
  return new THREE.MeshStandardMaterial({ color: map ? "#ffffff" : PAPEL, map, roughness: 0.92, metalness: 0 });
}

function useMateriales(crear: () => THREE.Material[], deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mats = useMemo(crear, deps);
  useEffect(
    () => () => {
      for (const m of mats) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      }
    },
    [mats],
  );
  return mats;
}

function Plegado({
  modelo,
  paginas,
  abierto,
  deEspaldas,
}: {
  modelo: Extract<ModeloLibrito, { tipo: "plegado" }>;
  paginas: HTMLCanvasElement[];
  abierto: boolean;
  deEspaldas: boolean;
}) {
  const { mk } = useTexturas();
  const ext = paginas[modelo.exterior];
  const int = paginas[modelo.interior];
  const mitad = modelo.anchoMitad;
  const tapaMats = useMateriales(() => {
    const canto = materialPapel(null);
    // Tapa: por dentro, la mitad izquierda del interior; por fuera, la mitad derecha del exterior.
    return [canto, canto, canto, canto, materialPapel(mk(int, 0, 0.5)), materialPapel(mk(ext, 0.5, 0.5))];
  }, [ext, int, mk]);
  const fijaMats = useMateriales(() => {
    const canto = materialPapel(null);
    // Contratapa: por dentro, la mitad derecha del interior; por fuera, la mitad izquierda del exterior.
    return [canto, canto, canto, canto, materialPapel(mk(int, 0.5, 0.5)), materialPapel(mk(ext, 0, 0.5))];
  }, [ext, int, mk]);

  const libro = useRef<THREE.Group>(null);
  const tapa = useRef<THREE.Group>(null);
  // Para ver la contratapa el librito cerrado se da vuelta entero, alrededor de su centro.
  const vuelta = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const t = tapa.current;
    const l = libro.current;
    const v = vuelta.current;
    if (!t || !l || !v) return;
    v.rotation.y = THREE.MathUtils.damp(v.rotation.y, deEspaldas ? Math.PI : 0, 5, Math.min(dt, 0.1));
    const destino = abierto ? ABIERTO : Math.PI;
    t.rotation.y = THREE.MathUtils.damp(t.rotation.y, destino, 5, Math.min(dt, 0.1));
    // Cerrado ocupa sólo la mitad derecha: se corre para que quede centrado.
    l.position.x = -(mitad / 2) * (t.rotation.y / Math.PI);
  });

  return (
    <group ref={vuelta}>
      <group ref={libro}>
        <mesh position={[mitad / 2, 0, 0]} material={fijaMats}>
          <boxGeometry args={[mitad, 1, GROSOR]} />
        </mesh>
        {/* Arranca cerrado: se ve la tapa. */}
        <group ref={tapa} position={[0, 0, GROSOR * 1.2]} rotation={[0, Math.PI, 0]}>
          <mesh position={[-mitad / 2, 0, 0]} material={tapaMats}>
            <boxGeometry args={[mitad, 1, GROSOR]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Hoja({
  modelo,
  paginas,
  hoja,
  volteada,
}: {
  modelo: Extract<ModeloLibrito, { tipo: "hojas" }>;
  paginas: HTMLCanvasElement[];
  hoja: number;
  volteada: boolean;
}) {
  const { mk } = useTexturas();
  const h = modelo.hojas[Math.min(hoja, modelo.hojas.length - 1)]!;
  const frente = paginas[h.frente];
  const dorso = h.dorso != null ? paginas[h.dorso] : undefined;
  const mats = useMateriales(() => {
    const canto = materialPapel(null);
    return [canto, canto, canto, canto, materialPapel(mk(frente)), materialPapel(mk(dorso))];
  }, [frente, dorso, mk]);
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, volteada ? Math.PI : 0, 5, Math.min(dt, 0.1));
  });
  return (
    <group ref={ref}>
      <mesh material={mats}>
        <boxGeometry args={[modelo.ancho, 1, GROSOR]} />
      </mesh>
    </group>
  );
}

/**
 * Pone la cámara a una distancia en la que entra el librito, según el tamaño de pantalla. Al
 * abrirlo o cerrarlo la cámara se acerca o se aleja sola (la persona después puede acercar a mano).
 */
function Encuadre({ ancho, alto }: { ancho: number; alto: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const controls = useThree((s) => s.controls) as unknown as { update?: () => void } | null;
  const destino = useRef<number | null>(null);
  const primera = useRef(true);
  useEffect(() => {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const margen = 1.12;
    const d = Math.max((alto * margen) / 2 / tan, (ancho * margen) / 2 / (tan * aspect));
    if (primera.current) {
      primera.current = false;
      camera.position.set(0, d * 0.16, d);
      camera.lookAt(0, 0, 0);
      controls?.update?.();
      return;
    }
    destino.current = d;
  }, [camera, aspect, ancho, alto, controls]);
  useFrame((_, dt) => {
    const d = destino.current;
    if (d == null) return;
    const actual = camera.position.length();
    const siguiente = THREE.MathUtils.damp(actual, d, 4, Math.min(dt, 0.1));
    camera.position.setLength(siguiente);
    if (Math.abs(siguiente - d) < 0.002) destino.current = null;
  });
  return null;
}

/**
 * Sombra suave en el piso, justo debajo del librito: una mancha difusa que sigue el tamaño del
 * modelo al abrirlo, girarlo o darlo vuelta. Más liviana y pareja entre celulares que una sombra
 * calculada.
 */
function Sombra({ objetivo }: { objetivo: React.RefObject<THREE.Group | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  const caja = useMemo(() => new THREE.Box3(), []);
  const tamano = useMemo(() => new THREE.Vector3(), []);
  const centro = useMemo(() => new THREE.Vector3(), []);
  const textura = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(70,50,30,0.34)");
    g.addColorStop(0.55, "rgba(70,50,30,0.14)");
    g.addColorStop(1, "rgba(70,50,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => textura.dispose(), [textura]);
  useFrame(() => {
    const m = ref.current;
    const o = objetivo.current;
    if (!m || !o) return;
    caja.setFromObject(o);
    if (caja.isEmpty()) return;
    caja.getSize(tamano);
    caja.getCenter(centro);
    m.position.set(centro.x, caja.min.y - 0.002, centro.z);
    m.scale.set(tamano.x * 1.25 + 0.25, tamano.z * 1.4 + 0.35, 1);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={textura} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Contenido(props: Props) {
  const { modelo, giro } = props;
  const modeloRef = useRef<THREE.Group>(null);
  // Ancho de lo que se ve ahora: cerrado, el plegado ocupa sólo una mitad.
  const ancho =
    modelo.tipo === "plegado" ? modelo.anchoMitad * (props.abierto ? 2 : 1) : modelo.ancho;
  const deCostado = giro % 180 !== 0;
  const roll = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = roll.current;
    if (!g) return;
    // Mismo sentido que la vista plana (CSS gira en sentido horario; three, al revés).
    const destino = -THREE.MathUtils.degToRad(giro);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, destino, 8, Math.min(dt, 0.1));
  });
  return (
    <>
      <color attach="background" args={[FONDO]} />
      <hemisphereLight args={["#ffffff", "#e9e0d4", 1.6]} />
      <directionalLight position={[1.6, 2.4, 3]} intensity={1.5} />
      <directionalLight position={[-1.6, 2.4, -3]} intensity={1.3} />
      <group ref={modeloRef}>
        <group ref={roll}>
          {modelo.tipo === "plegado" ? (
            <Plegado
              modelo={modelo}
              paginas={props.paginas}
              abierto={props.abierto}
              deEspaldas={!props.abierto && props.deEspaldas === true}
            />
          ) : (
            <Hoja modelo={modelo} paginas={props.paginas} hoja={props.hoja} volteada={props.volteada} />
          )}
        </group>
      </group>
      <Sombra objetivo={modeloRef} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.8}
        minDistance={0.9}
        maxDistance={6}
        minPolarAngle={Math.PI * 0.18}
        maxPolarAngle={Math.PI * 0.6}
      />
      <Encuadre ancho={deCostado ? 1 : ancho} alto={deCostado ? ancho : 1} />
    </>
  );
}

export default function LibritoEscena(props: Props) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ fov: 35, near: 0.05, far: 50, position: [0, 0.4, 3] }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      style={{ touchAction: "none" }}
    >
      <Contenido {...props} />
    </Canvas>
  );
}
