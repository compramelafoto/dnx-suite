# Info Spot — Responsive

**Versión:** 1.0  
**Estado:** Reglas oficiales responsive  
**Alcance:** Solo documentación. No implica cambios de UI ni implementación.

---

## 1. Principio

Info Spot es **mobile-first editorial**: primero se resuelve la lectura y la foto en una columna; luego se gana jerarquía y composición en pantallas mayores.

No se “achica un desktop magazine”. Se construye una experiencia clara en móvil y se enriquece en desktop.

---

## 2. Breakpoints

| Nombre | Min-width | Prioridad de diseño |
| --- | --- | --- |
| base | 0 | Lectura, stack, nav mobile |
| `sm` | 640px | Ajustes de controles |
| `md` | 768px | 2 columnas, header ampliado |
| `lg` | 1024px | Layout editorial completo |
| `xl` | 1280px | Max container / pad-x mayor |
| `2xl` | 1536px | No estirar medida de lectura |

Detalle de tokens en `03-design-system-foundations.md`.

---

## 3. Reglas generales

1. **Una columna por defecto** para contenido de lectura.
2. **Touch targets ≥ 44×44 px** en controles primarios.
3. **Pad-x crece con el viewport**; el texto de artículo no.
4. **Imágenes fluidas** con aspect ratio reservado (evitar CLS).
5. **Header compacto en mobile**; búsqueda puede colapsar a icono/página.
6. **Menú mobile** como sheet/overlay, no mega-menu.
7. **Grids**: 1 → 2 → 3 columnas máximo en listados editoriales.
8. **No ocultar información crítica** solo en mobile (fecha, lugar, crédito).
9. **Hover no es requisito**: todo debe funcionar sin hover.
10. **`prefers-reduced-motion`**: desactivar reveals no esenciales.

---

## 4. Tipografía responsive

| Rol | Comportamiento |
| --- | --- |
| Display / H1 | Escala fluida o steps en `md`/`lg` |
| Body | Tamaño estable; no achicar por debajo de ~17px |
| Meta | Legible; no comprimir tracking extremo |
| Dek | Puede subir un step en `md+` |

### Medida

- Artículo: máximo ~720px (`article-max`) en todos los anchos.
- Evitar líneas de más de ~75–80 caracteres en desktop.

---

## 5. Media responsive

| Contexto | Mobile | Desktop |
| --- | --- | --- |
| Hero home | Full width, aspect 4/5 o 16/9 según pieza | Full-bleed o split |
| Article hero | Full width del container | Hasta `media-max` |
| Cards | 16/9 o 4/3 consistente | Igual |
| Gallery | 1–2 cols | 2–3 cols |
| Portrait fotógrafo | Centrado | Izquierda / grid |

### Reglas de imagen

- `sizes` correctos para srcset.
- No cropear sujetos clave en breakpoints intermedios.
- Créditos siempre visibles; pueden pasar de overlay discreto a bloque debajo en mobile si hace falta contraste.

---

## 6. Navegación responsive

### Mobile (< md)

- Logo + iconos (search/menu).
- Nav en sheet.
- CTA primario puede vivir dentro del menú o como botón compacto.

### Desktop (≥ md/lg)

- Logo + links primarios visibles.
- Search box inline.
- CTA visible sin abrir menú.

### Sticky header

- Permitido si no tapa el hero de forma agresiva.
- En scroll, mantener altura contenida (`header-h`).

---

## 7. Layouts por breakpoint

### Home

| Elemento | base | md | lg+ |
| --- | --- | --- | --- |
| Hero | stack | stack/split | feature/split |
| Featured | 1 col | 2 cols | 3–4 / asimétrico |
| Card grids | 1 | 2 | 3 |
| Agenda | lista | lista | lista o 2 cols |

### Artículo

| Elemento | base | lg+ |
| --- | --- | --- |
| Texto | 100% útil | centrado `article-max` |
| Media | full container | `media-max` |
| Share | sticky bottom opcional V2 | inline bajo meta/pie |
| Relacionados | 1 col | 2–3 cols |

### Evento / Perfiles

| Elemento | base | lg+ |
| --- | --- | --- |
| Header | stack | split perfil/contenido |
| Facts | lista | aside o columna facts |
| Cobertura | 1 col | 2–3 cols |

### Agenda

| Elemento | base | md+ |
| --- | --- | --- |
| Filtros | stack / sheet | inline |
| Items | full width rows | rows con meta alineada |

### Búsqueda

| Elemento | base | md+ |
| --- | --- | --- |
| Query | full width | full width limitado |
| Filtros | chips scroll horizontal | chips/select inline |
| Results | 1 col | 1 col (legibilidad) |

---

## 8. Densidad y spacing

- Mobile: spacing generoso entre secciones, no entre cada línea de meta.
- Desktop: más aire horizontal; no rellenar con sidebars.
- Evitar “desktop denso + mobile aún más denso”.

| Viewport | Pad-x guía |
| --- | --- |
| <768 | 20px |
| ≥768 | 24px |
| ≥1024 | 32px |
| ≥1280 | 40px |

---

## 9. Performance responsive

- Priorizar LCP de hero image en home/artículo.
- Lazy-load below the fold.
- No cargar lightbox/gallery JS hasta interacción (ideal).
- Fuentes: subset/display swap; evitar FOUT extremo.

---

## 10. QA checklist responsive

- [ ] Home legible en 360×800 sin scroll horizontal
- [ ] Artículo: medida cómoda en 390 y 1440
- [ ] Header no solapa CTAs críticos
- [ ] Menú mobile usable con teclado y screen reader
- [ ] Imágenes sin CLS relevante
- [ ] Touch targets OK
- [ ] Agenda escaneable en mobile
- [ ] Búsqueda usable con teclado on-screen
- [ ] Créditos fotográficos visibles
- [ ] Sin dependencia de hover para acciones

---

## Documentos relacionados

- `03-design-system-foundations.md` — breakpoints y containers  
- `05-layouts.md` — estructura de páginas  
- `07-ux-principles.md` — principios de uso  
