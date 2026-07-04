# Fotolibro: Visualizador y Animación de Pase de Página

Documentación del sistema de visualización del fotolibro con modelo **hoja 2 caras** (FlipSheet). **Layflat 180°**: pliego abierto sin línea interna, imagen continua. Sin revealPhase ni z-index dinámicos.

---

## 1. Arquitectura general

### Rutas y archivos
- **Página:** `app/fotolibro/[id]/vista/page.tsx`
- **Estilos/animación:** `app/globals.css` (clases `fotolibro-*`)
- **Render de páginas:** `components/fotolibros/CanvasEditor.tsx` (modo `bookHalf`)
- **Hoja que gira:** `components/fotolibros/FlipSheet.tsx`

### Estados del libro
1. **closed** – Tapa cerrada
2. **opening** – Animación de apertura de tapa
3. **open** – Libro abierto mostrando spreads

### Estados durante el pase de página
- **isFlipping** – Indica que hay un giro en curso
- **direction** – `"next"` (siguiente) o `"prev"` (anterior)
- **NO hay revealPhase** – El cambio se da naturalmente al pasar 90° por `backface-visibility: hidden` en las caras

---

## 2. Modelo hoja 2 caras (FlipSheet)

### Estructura
```
.fotolibro-sheet (preserve-3d, anima rotateY)
├── .fotolibro-sheet-shadow (sombra dinámica)
├── .fotolibro-sheet-face-front (backface-visibility: hidden)
│   └── CanvasEditor → spread que se está girando
└── .fotolibro-sheet-face-back (rotateY(180deg), backface-visibility: hidden)
    └── CanvasEditor → spread destino (visible tras 90°)
```

### Mapeo según direction
- **direction = next** (girar derecha → izquierda):
  - Base left = current spread
  - Base right (debajo) = next spread
  - Sheet.front = current.right (la que gira)
  - Sheet.back = next.left (la que quedará del lado izq al terminar)

- **direction = prev** (girar izquierda → derecha):
  - Base right = current spread
  - Base left (debajo) = prev spread
  - Sheet.front = current.left (la que gira)
  - Sheet.back = prev.right

### Orientación de la cara trasera
- La cara back tiene `transform: rotateY(180deg)`. No se usa `scaleX(-1)` para evitar doble espejo al terminar la animación.

---

## 3. Layout del spread (Layflat 180°)

- **Stage:** `.fotolibro-stage` con `perspective: 1400px` (solo en parent)
- **Book:** `.fotolibro-book` con `preserve-3d`, `rotateX(6deg)`
- **Base:** un solo canvas con `splitSpreads` durante el giro (evita línea en el pliegue)
- **Páginas base:** `.fotolibro-page-full` clipeada, radios en 4 esquinas externas
- **Hoja:** `.fotolibro-sheet` con `clip-path` per-corner en caras (radios solo externos: right=tr/br, left=tl/bl)

### Clipping / oclusión
- Ningún spread de fondo puede overflowear durante el giro.
- Solo la hoja que gira puede tener contenido visible fuera del área, pero clipeado con `clip-path`.
- `allowOverflow={false}` en todos los CanvasEditor del FlipSheet.

---

## 4. Animación del giro

### Keyframes
- **fotolibro-sheet-next:** rotateY(0 → -180), `transform-origin: left center`
- **fotolibro-sheet-prev:** rotateY(0 → +180), `transform-origin: right center`
- Duración: 1.2s, easing: `cubic-bezier(0.22, 1, 0.36, 1)`
- A los 50%: `translateZ(12px)` + `box-shadow` para efecto de lift y sombra propia

### Sombras
- **Sombra de contacto:** `.fotolibro-base-shadow` en la base del lado del giro (gradient centro → borde)
- **Sombra propia:** `.fotolibro-sheet-shadow` con keyframe de opacidad (0 → 1 → 0)

### Fin de animación
- `onAnimationEnd` en el elemento con la animación (detecta `fotolibro-sheet-`)
- Al terminar: `setCurrentIndex(+1 o -1)`, `setIsFlipping(false)`
- Sin setTimeout, sincronía real con el keyframe

---

## 5. CanvasEditor y modo bookHalf

- `bookHalf="left"` → mitad izquierda del spread
- `bookHalf="right"` → mitad derecha del spread
- En FlipSheet siempre `allowOverflow={false}` para evitar escapes de contenido

---

## 6. Flujo de datos (actual)

```
Usuario hace clic "siguiente"
  → playPageTurnSound()
  → setIsFlipping(true), setDirection("next")
  → Se monta FlipSheet con front=current.right, back=next.left
  → onAnimationEnd: setCurrentIndex(i+1), setIsFlipping(false)
  → Se desmonta FlipSheet, se actualizan páginas base
```

---

## 7. CSS relevante (resumen)

```css
.fotolibro-stage { perspective: 1400px; }
.fotolibro-book { transform-style: preserve-3d; transform: rotateX(6deg); }
.fotolibro-page { clip-path: inset(0 round var(--fotolibro-page-radius)); overflow: hidden; }
.fotolibro-sheet { transform-style: preserve-3d; will-change: transform; }
.fotolibro-sheet-face { backface-visibility: hidden; clip-path per-corner (right: tr/br, left: tl/bl); }
.fotolibro-sheet-face-back { transform: rotateY(180deg); }
```

---

## 8. Criterios de aceptación (implementados)

- **Layflat 180°:** Sin línea del lomo, sin spine gap, imagen continua en el centro.
- Durante todo el giro, el contenido "de atrás" nunca se escapa (clip-path, overflow hidden).
- No hay saltos por z-index ni opacity hacks.
- Next y Prev simétricos.
- `onAnimationEnd` para sincronía; sin setTimeout.
- Performance OK (will-change en la hoja).
