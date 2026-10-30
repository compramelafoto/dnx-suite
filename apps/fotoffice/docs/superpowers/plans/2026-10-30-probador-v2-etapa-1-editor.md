# Probador de cuadros v2 — Etapa 1 (Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poder editar cada cuadro por separado, con deshacer y rehacer (⌘Z), conjuntos libres de una sola foto y tipos Impresión, Canvas y Con marco. Sin precios ni pedido.

**Architecture:**
- La composición pasa a ser un dato puro en cm (`lib/probador/composicion.ts`). Sus operaciones son funciones puras con pruebas, y el encuadre de cada foto también (`lib/probador/encuadre.ts`).
- El motor (`components/probador/motor.ts`) guarda la composición actual dentro de un historial puro (`lib/probador/historial.ts`), la dibuja y traduce gestos a operaciones.
- La proyección a la pared, WebGL y el living de ejemplo quedan como están.

**Tech Stack:** TypeScript, React 19 (Next.js de la app), Canvas 2D y WebGL, Vitest.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-30-probador-de-cuadros-v2-design.md` (secciones 2, 5 y 6; la etapa 1 de la sección 8).

## Global Constraints

- Todo texto visible va en español rioplatense ("Tocá", "Arrastrá"), sin "plata".
- Deshacer con ⌘Z / Ctrl+Z; rehacer con ⇧⌘Z / Ctrl+Y. Hasta 50 pasos. El historial no copia imágenes.
- Si el foco está en un `input`, `select` o `textarea`, los atajos quedan para ese campo.
- Inclinación entre −15° y +15°. Rotación de a 90°.
- Paspartú: 0, 3, 5 u 8 cm. Solo aplica al tipo "Con marco".
- "Con marco" usa un marco genérico negro. Elegir modelo queda deshabilitado con el cartel "Próximamente".
  - **Desvío del spec, decidido al planificar:** el spec deshabilitaba el tipo entero. Daniel pidió el paspartú opcional, y eso solo tiene sentido con marco, así que el tipo se habilita y solo se deshabilita la elección de modelo.
- El cuadro nunca muestra vacío: la escala mínima se ajusta sola para cubrir con la foto girada.
- No se agregan dependencias.

## Review Focus

1. **Inclinar al máximo con la foto ya al mínimo de zoom.** No pueden aparecer esquinas vacías. Prueba en Task 1: `normalizarEncuadre` con `incl = 15` y foto horizontal en cuadro vertical.
2. **Quitar cuadros hasta que quede uno.** Nunca se puede quedar en cero. Prueba en Task 2: `quitarCuadro` sobre un conjunto de 1.
3. **Deshacer después de deshacer y hacer algo nuevo.** El rehacer se descarta. Prueba en Task 3.
4. **Atajo ⌘Z mientras se escribe la medida de referencia.** No tiene que deshacer el probador: lo verifica Task 4 en el navegador.
5. **Una foto para todos con cuadros escalonados.** La foto cubre el rectángulo que envuelve a todos, y cada cuadro muestra su parte sin vacío. Prueba en Task 2: `rectanguloDelConjunto` sobre el escalonado 5.

---

### Task 1: Encuadre de una foto dentro de un rectángulo

**Files:**
- Create: `apps/fotoffice/lib/probador/encuadre.ts`
- Test: `apps/fotoffice/lib/probador/encuadre.test.ts`

**Interfaces:**
- Produces:
  - `type Encuadre = { cx: number; cy: number; escala: number; rot90: 0|90|180|270; incl: number }`. `cx` y `cy` van de 0 a 1 sobre la foto ya rotada de a 90°: es el punto que cae en el centro del cuadro. `escala` vale 1 o más, relativa al "cubrir sin girar".
  - `ENCUADRE_INICIAL: Encuadre` = `{ cx: .5, cy: .5, escala: 1, rot90: 0, incl: 0 }`.
  - `dimensionesRotadas(foto: {w,h}, rot90) → {w,h}`.
  - `escalaMinima(rect: {w,h}, foto: {w,h}, e: Encuadre) → number`: en unidades de `escala`; es ≥ 1 cuando `incl ≠ 0`.
  - `normalizarEncuadre(e, rect, foto) → Encuadre`: limita la escala al rango [mínima, 8], la inclinación a [−15, 15] y el centro para que no quede vacío.
  - `transformacion(e, rect, foto) → { s: number; theta: number; fx: number; fy: number }`. `s` son cm por píxel; `theta` es la inclinación en radianes; `fx`, `fy` son el punto de la foto rotada (en px) que va al centro del cuadro.
  - `desplazar(e, dxCm, dyCm, rect, foto) → Encuadre`: mueve la foto como si se arrastrara. Pasa el desplazamiento del cuadro a la foto con −theta y lo normaliza.

- [ ] **Step 1: Escribir las pruebas**
  - `encuadre inicial cubre sin girar`: un rectángulo de 50×70 y una foto de 3000×2000 dan `s = 70/2000`.
  - `inclinar exige más zoom`: `escalaMinima({w:50,h:70},{w:3000,h:2000},{...I, incl:15}) > 1`.
  - `normalizar no deja vacío`: con `incl = 15`, `escala = 1` y `cx = 0`, el resultado tiene `escala ≥ escalaMinima` y, para cada esquina del rectángulo llevada a la foto, `0 ≤ x ≤ w` y `0 ≤ y ≤ h`, con una tolerancia de 1e-6.
  - `rot90 de 90 intercambia lados`: `dimensionesRotadas({w:3000,h:2000},90)` da `{w:2000,h:3000}`.
  - `desplazar a la derecha corre el centro a la izquierda de la foto`: con `incl = 0`, `desplazar(I, 5, 0, …)` deja `cx < .5`.
- [ ] **Step 2:** `npx vitest run lib/probador/encuadre.test.ts`. Tiene que fallar porque el módulo no existe.
- [ ] **Step 3:** implementar. La regla de cobertura:
  - un rectángulo girado entra en la foto (sin girar) si y solo si su caja envolvente entra;
  - `hx = (|W cosθ| + |H sinθ|) / (2s)`, `hy = (|W sinθ| + |H cosθ|) / (2s)`;
  - la escala mínima absoluta es `max((|W cos|+|H sin|)/pw, (|W sin|+|H cos|)/ph)`;
  - el centro en px queda entre `[hx, pw−hx]` y `[hy, ph−hy]`.
- [ ] **Step 4:** las pruebas pasan.
- [ ] **Step 5:** commit "Calcular el encuadre de cada foto en el probador".

### Task 2: Composición libre

**Files:**
- Create: `apps/fotoffice/lib/probador/composicion.ts`
- Modify: `apps/fotoffice/lib/probador/geometria.ts`. Se agregan las plantillas `escalonado4` y `escalonado5` a `COMPOSICIONES` y a `cuadrosDe`.
- Test: `apps/fotoffice/lib/probador/composicion.test.ts` y `geometria.test.ts` (extender).

**Interfaces:**
- Consumes: `Encuadre` y `ENCUADRE_INICIAL` (Task 1); `cuadrosDe`, `ComposicionId` y `Rect` (geometria).
- Produces:
  - `type TipoCuadro = "IMPRESION" | "CANVAS" | "MARCO"`.
  - `type Cuadro = { id: string; tipo: TipoCuadro; x: number; y: number; w: number; h: number; paspartu: number; foto: number; encuadre: Encuadre }`. Las medidas van en cm; `x` e `y` son relativas al origen del conjunto.
  - `type Composicion = { cuadros: Cuadro[]; unaFoto: boolean; fotoConjunto: number; encuadreConjunto: Encuadre; ox: number; oy: number }`. `ox` y `oy` son la esquina superior izquierda del origen sobre la pared, en cm.
  - `PASPARTUS = [0, 3, 5, 8] as const`.
  - `desdePlantilla(id: ComposicionId, w, h, sep, tipo: TipoCuadro, centro: {x,y}) → Composicion`: los cuadros van con `foto = i`; el conjunto queda centrado en `centro`; el paspartú es 5 si el tipo es MARCO y 0 si no.
  - `rectanguloDelConjunto(c) → Rect`: la caja envolvente, relativa al origen.
  - `moverConjunto(c, dx, dy)`.
  - `moverCuadro(c, id, dx, dy, tolCm = 1) → { comp: Composicion; guias: { x: number[]; y: number[] } }`. Encastra el borde izquierdo, el centro y el borde derecho, y el borde superior, el centro y el borde inferior, con los de los otros cuadros, dentro de `tolCm`.
  - `cambiarMedida(c, id, w, h)`: conserva el centro del cuadro.
  - `cambiarCuadro(c, id, cambios: Partial<Pick<Cuadro,"tipo"|"paspartu"|"foto"|"encuadre">>)`.
  - `duplicarCuadro(c, id)`: lo coloca a la derecha del conjunto, con la separación de 5 cm.
  - `quitarCuadro(c, id)`: no hace nada si queda uno solo.
  - `aplicarATodos(c, cambios: { w?, h?, tipo?, paspartu? })`.
  - `rectFoto(cuadro) → Rect`: la ventana de la foto. Descuenta el perfil del marco genérico (2,5 cm) y el paspartú cuando el tipo es MARCO.
- `escalonado4`, con `w×h` base: los dos de afuera miden `w × 0,6h`; los dos del centro, `0,5w × h`; todos centrados en alto. Es la referencia 2.
- `escalonado5`: los cinco miden `0,6w` de ancho; los altos son `[0,6; 0,8; 1; 0,8; 0,6] × h`, centrados en alto. Es la referencia 3.

- [ ] **Step 1: Escribir las pruebas**
  - `escalonado5 tiene el del centro más alto y todos centrados`.
  - `moverCuadro encastra el borde izquierdo a 0,6 cm del de un vecino` y devuelve la guía.
  - `cambiarMedida conserva el centro`.
  - `quitarCuadro no deja el conjunto vacío`.
  - `duplicarCuadro agrega un id nuevo`.
  - `rectanguloDelConjunto del escalonado5 envuelve a los cinco`.
  - `rectFoto de MARCO con paspartú 5 resta 7,5 cm por lado`.
  - Extender la prueba de `geometria` "ninguno se superpone" para que cubra las plantillas nuevas.
- [ ] **Step 2:** las pruebas fallan.
- [ ] **Step 3:** implementar. Los ids nuevos se generan con un contador del módulo (`c1`, `c2`…), no con azar, para que las pruebas sean estables.
- [ ] **Step 4:** las pruebas pasan, incluida `geometria.test.ts`.
- [ ] **Step 5:** commit "Composición libre del probador con plantillas escalonadas".

### Task 3: Historial (deshacer y rehacer)

**Files:**
- Create: `apps/fotoffice/lib/probador/historial.ts`
- Test: `apps/fotoffice/lib/probador/historial.test.ts`

**Interfaces:**
- Produces:
  - `type Historial<T> = { pasado: T[]; actual: T; futuro: T[] }`.
  - `iniciar<T>(t: T)`.
  - `registrar<T>(h: Historial<T>, t: T, max = 50)`: si `t === actual`, no hace nada; si no, vacía el futuro y recorta el pasado a `max`.
  - `deshacer<T>(h)` y `rehacer<T>(h)`: si no hay hacia dónde ir, devuelven `h` sin tocarlo.
  - `puedeDeshacer(h)` y `puedeRehacer(h)`.

- [ ] **Step 1: Escribir las pruebas**
  - deshacer y rehacer vuelven al mismo estado;
  - registrar después de deshacer descarta el futuro;
  - con 60 cambios quedan 50 pasos de deshacer;
  - deshacer sin pasado devuelve el mismo objeto.
- [ ] **Step 2:** las pruebas fallan.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** las pruebas pasan.
- [ ] **Step 5:** commit "Historial para deshacer en el probador".

### Task 4: Editor en pantalla

**Files:**
- Modify: `apps/fotoffice/components/probador/motor.ts`. La composición, el dibujo, la interacción y el panel cambian; la pared, WebGL, el living, las muestras y la proyección quedan.
- Modify: `apps/fotoffice/components/probador/probador-cuadros.tsx`. Marcado de los paneles "Conjunto" y "Este cuadro", botones ↶ ↷ y CSS.

**Interfaces:**
- Consumes: Tasks 1–3.

**Comportamiento** (spec 5.1–5.4):

- **Estado:** `hist: Historial<Composicion>`.
  - Cada operación terminada (soltar un arrastre, un cambio en el panel) llama a `registrar`.
  - Durante un arrastre se dibuja un estado temporal que no se registra.
- **Capa:** cada cuadro se dibuja según su tipo.
  - **IMPRESION:** la foto con una sombra fina y un borde de papel de 0,2 cm.
  - **CANVAS:** la foto y oscurecido de costado, como el lienzo de hoy.
  - **MARCO:** el marco negro de 2,5 cm de hoy y el paspartú del cuadro.
  - La foto se dibuja con `transformacion`: clip a `rectFoto`, trasladar al centro, rotar `theta`, escalar `s`, rotar `rot90` y dibujar centrado en `fx`, `fy`.
  - Con `unaFoto`, el rectángulo del encuadre es `rectanguloDelConjunto` y cada cuadro recorta su parte.
- **Punteros:**
  - Un toque sobre un cuadro lo selecciona. Afuera, deselecciona.
  - Sin selección, arrastrar mueve el conjunto. Con selección, arrastrar ese cuadro lo mueve, con encastre y guías dibujadas.
  - Doble toque o el botón "Encuadrar foto" entra en modo encuadre:
    - arrastrar llama a `desplazar` (sobre el encuadre del conjunto si `unaFoto`);
    - la rueda multiplica la escala por 1,1;
    - dos punteros pellizcan para la escala y giran para `incl`.
    - Se sale con Esc o con "Listo".
- **Teclado:**
  - ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y;
  - flechas para mover el cuadro seleccionado, o el conjunto (⇧ = 10 cm);
  - Supr o Backspace quita el cuadro seleccionado;
  - Esc sale del encuadre y después deselecciona.
  - Se ignoran si `document.activeElement` es `input`, `select` o `textarea`.
- **Panel "Conjunto"** (sin selección):
  - plantillas, incluidas las dos nuevas;
  - medida y orientación para todos;
  - tipo para todos (Impresión, Canvas, Con marco);
  - separación;
  - "Una foto para todos";
  - paspartú para todos;
  - "Modelo de marco: Próximamente", deshabilitado.
  - Al cambiar de plantilla se rehace la composición con `desdePlantilla`, conservando el centro.
- **Panel "Este cuadro"** (con selección):
  - tipo; medida y orientación; foto (las miniaturas);
  - rotar 90°; inclinación (rango −15…15 con "0°"); zoom (rango); "Centrar foto";
  - paspartú (solo MARCO);
  - "Duplicar" y "Quitar";
  - "Listo" para deseleccionar.
- **Medidas debajo de la foto:** las de hoy, más la cantidad y el detalle por medida de cada cuadro.
- **Imagen final:** igual que hoy, sin guías.

- [ ] **Step 1:** reescribir el motor sobre `Composicion` e `Historial`, y el marcado de los paneles.
- [ ] **Step 2:** `tsc` sobre los archivos tocados (tsconfig acotado, como en el PR 880) y `eslint` sin errores.
- [ ] **Step 3: Verificación en el navegador** (`next dev --webpack --port 3077`, `/w/dnx-estudio/probador-de-cuadros`):
  - plantilla Escalonado 5 con "Una foto para todos": se ve como la referencia 3;
  - seleccionar un cuadro, cambiarle la medida y moverlo con encastre;
  - encuadre con arrastre, rueda e inclinación a 15°, sin esquinas vacías;
  - ⌘Z deshace los tres pasos y ⇧⌘Z los rehace;
  - ⌘Z con el foco en "Ancho de lo marcado" no deshace el probador;
  - quitar hasta que quede uno;
  - en celular (375 px), sin desplazamiento lateral.
- [ ] **Step 4:** commit "Editor por cuadro en el probador: encuadre, medida, posición y deshacer".

### Task 5: Entrega

- [ ] Pruebas completas de la app (`npx vitest run` en `apps/fotoffice`) en verde.
- [ ] PR contra `main`. Fusionar con los controles en verde, con permiso de Daniel ya dado para esta etapa.
- [ ] Verificar en producción `fotoffice.com/w/dnx-estudio/probador-de-cuadros`: carga sin errores de consola y el escalonado se ve.
