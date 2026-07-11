# Info Spot — Brand Book

**Versión:** 1.0  
**Estado:** Guía oficial de identidad visual  
**Alcance:** Solo documentación. No implica cambios de UI ni implementación.

---

## 1. Personalidad

Info Spot es el medio digital oficial del ecosistema DNX Suite. Su personalidad se define por cinco rasgos:

| Rasgo | Descripción |
| --- | --- |
| **Editorial** | Prioriza la historia, la imagen y la lectura. No prioriza métricas ni paneles. |
| **Contemporáneo** | Se siente actual, limpio y preciso. Evita nostalgia de portales y plantillas genéricas. |
| **Confiable** | Habla con autoridad sin soberbia. La información se presenta con claridad y rigor. |
| **Visual** | La fotografía y la composición son protagonistas, no decoración. |
| **Humano** | Habla de personas, eventos y experiencias reales del ecosistema DNX. |

**En una frase:** Info Spot es un medio digital moderno, visual y editorial — no un blog, no un dashboard, no un portal de noticias genérico.

---

## 2. Tono

### Cómo habla

- Claro, directo y preciso.
- Seguro, sin exageración comercial.
- Cercano al lector, sin familiaridad forzada.
- Orientado a hechos, contexto y atmósfera.

### Cómo no habla

- No usa jerga de startup ni slogans vacíos.
- No suena a panel administrativo (“gestiona”, “dashboard”, “métricas”).
- No suena a blog personal ni a newsletter promocional agresiva.
- No usa clickbait ni titulares sensacionalistas.

### Registro por contexto

| Contexto | Tono |
| --- | --- |
| Titulares | Cortos, concretos, con peso editorial |
| Bajadas / leads | Informativos; atmosféricos cuando aporta |
| Metadata | Neutra, funcional, tipográficamente secundaria |
| CTAs | Discretos y útiles (“Leer”, “Ver agenda”, “Compartir”) |
| Errores / vacíos | Honestos y calmados, nunca alarmistas |

---

## 3. Identidad

### Qué es

Info Spot es el canal editorial del ecosistema DNX Suite: noticias, eventos, agendas, organizadores, fotógrafos y cobertura visual del mundo DNX.

### Qué no es

- Un CMS genérico con skin de noticias.
- Un panel interno de DNX Suite.
- Un marketplace.
- Un feed social.
- Un blog de marca corporativa.

### Relación con DNX Suite

Info Spot pertenece al ecosistema DNX, pero tiene identidad propia. Comparte rigor y calidad, no la estética de producto/software. El medio debe sentirse editorial; la suite, operativa.

---

## 4. Misión visual

La interfaz debe transmitir:

1. **Jerarquía editorial** — lo importante se ve primero.
2. **Respiración** — espacio en blanco como herramienta, no como vacío.
3. **Fotografía protagonista** — imagen grande, nítida, con intención.
4. **Tipografía como estructura** — el texto organiza, no decora.
5. **Calma moderna** — densidad controlada, sin ruido visual.

**Test de marca:** si se quita el logo y la página podría pasar por un template de WordPress, un dashboard o un portal antiguo, la composición falló.

---

## 5. Uso del logo

La identidad de Info Spot está definida mediante el logo aprobado en tres variantes:

| Variante | Uso principal |
| --- | --- |
| **Horizontal (wordmark)** | Header, pie, firmas, cabeceras de sección, OG/share cuando el formato lo permita |
| **Isotipo (mark)** | Favicon, avatar, espacios reducidos, marca en UI densa |
| **Monocromático** | Fondos de color sólido, sobreimpresión, impresión, fondos fotográficos con contraste controlado |

### Assets de referencia (repositorio)

- Wordmark: `apps/infospot/public/infospot-logo.svg`
- Isotipo: `apps/infospot/public/infospot-mark.svg`

### Reglas de uso

- Respetar proporciones originales. No estirar, comprimir ni rotar.
- Mantener área de protección equivalente a la altura del isotipo (mínimo).
- Usar la variante adecuada al contexto: horizontal por defecto; isotipo solo cuando el espacio no permita leer “Info Spot”.
- Sobre fotografía: preferir monocromático claro/oscuro según contraste; nunca forzar color de marca si reduce legibilidad.
- El logo no debe competir con el titular hero: en home, el logo ancla marca; el titular ancla contenido.
- Animación del logo: solo microinteracciones discretas (opacidad/fade). Nunca bounce, spin o morph.

### Tamaños mínimos recomendados

| Variante | Mínimo digital |
| --- | --- |
| Horizontal | Altura ≥ 24 px (recomendado ≥ 36 px en header) |
| Isotipo | ≥ 20 × 20 px (recomendado 40 × 40 px en UI) |
| Favicon | 32 × 32 px (y set multi-resolución) |

> **Punto abierto:** confirmar paquete oficial de variantes monocromáticas (claro/oscuro), versiones para fondo naranja y kit de exportación (SVG/PNG/PDF).

---

## 6. Uso incorrecto

**Nunca:**

- Distorsionar, sesgar o alterar proporciones.
- Cambiar colores del logo fuera de las variantes aprobadas.
- Añadir sombras, glows, outlines o efectos 3D.
- Colocar el logo dentro de formas no aprobadas (círculos, pills, badges improvisados).
- Usar el logo como patrón de fondo o watermark repetido.
- Superponer el logo sobre zonas fotográficas de bajo contraste.
- Combinar el logo con tipografías no oficiales en lockups improvisados.
- Animar el logo de forma juguetona o como loading spinner.
- Usar versiones antiguas, no aprobadas o recortadas.
- Reemplazar el wordmark por texto tipográfico “Info Spot” en el header.

---

## 7. Colores

### Principios

- Paleta contenida: pocos colores, alto contraste tipográfico.
- El color acentúa jerarquía; no decora.
- Fondos preferentemente neutros y luminosos (medio editorial claro).
- El acento se usa con moderación: links, estados activos, badges, CTAs primarios.
- Sin modo oscuro en la identidad de lanzamiento (salvo decisión explícita posterior).

### Roles semánticos

| Rol | Función |
| --- | --- |
| **Background** | Lienzo de lectura |
| **Background secondary** | Secciones alternadas / respiro |
| **Surface** | Contenedores sutiles cuando hacen falta |
| **Foreground / Ink** | Texto principal |
| **Muted** | Metadata, captions, secundarios |
| **Border / Hairline** | Separadores discretos |
| **Accent** | Enfoque editorial / interacción primaria |
| **Success / Warning / Danger** | Solo estados funcionales, no branding |

### Valores de referencia (fundación actual)

| Token | Valor | Uso |
| --- | --- | --- |
| `--is-bg` | `#ffffff` | Fondo principal |
| `--is-bg-secondary` | `#f5f6f8` | Secciones alternadas |
| `--is-surface` | `#ffffff` | Superficies |
| `--is-surface-muted` | `#eef0f3` | Superficies suaves / placeholders |
| `--is-text` | `#1a1d23` | Texto principal |
| `--is-text-secondary` | `#4a5160` | Cuerpo / subtítulos |
| `--is-muted` | `#6b7380` | Metadata |
| `--is-border` | `#e4e7ec` | Bordes |
| `--is-border-strong` | `#c9ced8` | Bordes enfatizados |
| `--is-accent` | `#e85d04` | Acento Info Spot (naranja) |
| `--is-accent-hover` | `#c44e03` | Hover del acento |
| `--is-accent-soft` | `#fff0e6` | Fondos de acento suaves |
| `--is-accent-ink` | `#9a3d02` | Texto sobre soft / selection |

> **Punto abierto:** validar el naranja `#e85d04` contra el logo aprobado (pantone/hex oficial) y definir escala completa (50–900) si se necesita.

Detalle técnico en `03-design-system-foundations.md`.

---

## 8. Tipografía

### Principios

- Tipografía editorial, no de producto SaaS.
- Evitar stacks por defecto como identidad (Inter, Roboto, Arial, system-ui).
- Claridad de lectura larga: interlineado generoso, medida controlada.
- Titulares con peso y tracking negativo moderado; cuerpo con confort de lectura.

### Roles tipográficos

| Rol | Uso |
| --- | --- |
| **Display** | Heroes, titulares de portada |
| **Headline** | Títulos de artículo / sección |
| **Body** | Texto de artículo |
| **Dek / Lead** | Bajada editorial |
| **Meta** | Fecha, categoría, autor, lectura estimada |
| **Caption** | Pie de foto / crédito |
| **UI** | Botones, navegación, formularios |
| **Label** | Categorías, badges, overlines |

### Familia de referencia (estado actual)

- Sans editorial: **Plus Jakarta Sans** (`--font-info-sans`)

> **Punto abierto:** confirmar si Plus Jakarta Sans es la tipografía definitiva de marca o si se introduce una display/serif editorial para titulares (recomendado evaluar para reforzar sensación de medio).

Detalle de escala en `03-design-system-foundations.md`.

---

## 9. Fotografía

La fotografía es el activo visual más importante de Info Spot.

### Debe

- Mostrar eventos, personas, atmósfera y contexto reales.
- Tener intención editorial: encuadre, luz, momento.
- Ocupar espacio generoso en heroes y cards fotográficas.
- Respetar créditos de fotógrafo de forma visible y digna.

### No debe

- Usar stock genérico cuando exista cobertura real.
- Recortar rostros o acción de forma agresiva.
- Tratar la imagen como thumbnail decorativo.
- Superponer badges, stickers o chips flotantes sobre la foto hero.
- Aplicar filtros de marca inconsistentes.

### Tratamiento

- Contraste natural; evitar overlays pesados.
- Si hay texto sobre imagen, garantizar contraste AA+ y zona segura.
- Preferir full-bleed en heroes de portada y artículo cuando el contenido lo merezca.
- Placeholders: neutros (`surface-muted`), nunca patrones ruidosos.

---

## 10. Iconografía

- Iconos lineales, simples, de trazo consistente.
- Tamaño y peso subordinados al texto y la foto.
- No usar iconos como ornamento de sección.
- No usar emojis como sistema de iconografía.
- Preferir un set único (no mezclar filled/outline sin regla).

**Usos válidos:** share, search, calendar, location, external link, play, gallery, menu, close, chevron.

> **Punto abierto:** elegir librería oficial (p. ej. Lucide / set custom) y peso de trazo.

---

## 11. Espaciados

- El espacio en blanco es parte de la marca.
- Preferir ritmo vertical generoso entre bloques editoriales.
- Evitar “rellenar” con cards, bordes y sombras.
- Agrupar lo relacionado; separar lo distinto.
- Densidad alta solo en metadata y listados secundarios.

Escala numérica en `03-design-system-foundations.md`.

---

## 12. Composición

### Reglas de composición

1. **Una composición, no un dashboard** — el primer viewport debe leerse como una pieza editorial.
2. **Brand + historia** — marca presente; el contenido manda.
3. **Un foco por sección** — un propósito, un titular, una idea.
4. **Foto como plano dominante** — especialmente en home y artículo.
5. **Sin cards por defecto** — las cards existen para interacción o agrupación clara, no como estilo.
6. **Sin clutter** — evitar strips de stats, pills múltiples, callouts flotantes, widgets laterales ruidosos.
7. **Lectura primero** — en páginas de contenido, la tipografía y la medida mandan sobre widgets.

### Anti-patrones visuales

- Layout tipo WordPress magazine con sidebars densas.
- Grillas de cards idénticas sin jerarquía.
- Hero con imagen inset en tarjeta redondeada flotante.
- Overlays de badges sobre fotografía hero.
- Fondos flat sin atmósfera *o* atmósfera abstracta sin ancla real (foto/contexto).
- Gradientes púrpura, glows, pills excesivas, multi-shadow.

---

## 13. Referencias conceptuales (no copiar)

Inspiración de sensación, no de skin:

| Referencia | Qué tomar |
| --- | --- |
| Apple News | Claridad, tipografía, ritmo de portada |
| The Athletic | Autoridad editorial, foco en historia |
| Medium | Experiencia de lectura |
| Airbnb Editorial | Fotografía y atmósfera |
| Stripe | Precisión y modernidad (sin parecer SaaS) |
| Sony Alpha Universe | Cultura fotográfica y cobertura visual |

---

## Documentos relacionados

- `02-editorial-language.md` — lenguaje y sensación editorial  
- `03-design-system-foundations.md` — tokens y escalas  
- `04-component-library.md` — inventario de componentes  
- `05-layouts.md` — layouts de página  
- `07-ux-principles.md` — principios de experiencia  
