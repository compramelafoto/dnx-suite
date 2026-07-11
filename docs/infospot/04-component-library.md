# Info Spot — Component Library

**Versión:** 1.0  
**Estado:** Inventario oficial de componentes (documentación)  
**Alcance:** Solo documentación. **No implementar** componentes en este entregable.

> Este documento define *qué existirá*. La implementación se hará en fases del roadmap (`08-roadmap-ui.md`).

---

## 1. Principios de componentes

- Cada componente tiene un trabajo claro.
- Preferir composición editorial sobre widgets genéricos.
- Cards solo cuando agrupan interacción o entrada a contenido.
- Sin decoración: borde/espacio antes que sombra.
- Accesibles por defecto (foco, contraste, labels, teclado).
- API consistente: `size`, `tone`, `asChild`/`href` cuando aplique.

---

## 2. Inventario completo

### 2.1 Brand & shell

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Logo** | Marca clickeable | Variantes: `wordmark`, `mark`, mono |
| **Site Header** | Navegación global + búsqueda + CTA | Sticky, altura tokenizada |
| **Mobile Navigation** | Nav off-canvas / sheet | Focus trap, esc to close |
| **Site Footer** | Links, créditos, legal, marca | Secundario, no denso |
| **Skip Link** | Accesibilidad | “Saltar al contenido” |
| **Page Shell** | Wrapper de página | Header + main + footer |
| **Section** | Bloque vertical con spacing/tone | `md` / `lg` / `xl`; `default` / `muted` |
| **Container** | Anchos `site` / `editorial` / `article` / `media` | Respeta pad-x |
| **Divider** | Separador hairline | Horizontal / con label opcional |

### 2.2 Navegación & wayfinding

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Nav Link** | Link de header | Estado activo discreto |
| **Breadcrumb** | Jerarquía de ubicación | Categoría → artículo / evento |
| **Tabs** | Cambio de vista en listados | Agenda (día/semana), perfiles |
| **Pagination** | Páginas de listado | Preferir “cargar más” solo si UX lo justifica |
| **Back Link** | Volver al listado padre | En artículo/evento |
| **Anchor Nav** | Índice en artículos largos | Opcional V2 |
| **Search Box** | Entrada de búsqueda | Header + página de resultados |
| **Search Suggestions** | Autocomplete | V2 |

### 2.3 Acciones

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Button** | Acción primaria/secundaria | `primary`, `secondary`, `ghost`, `danger` |
| **Icon Button** | Acción compacta | Menu, close, share |
| **Link Button** | CTA con apariencia de botón | Para navegación |
| **Text Link** | Link inline editorial | En cuerpo y meta |
| **Share** | Compartir historia | Native share + copiar link + redes |
| **Copy Link** | Copiar URL | Feedback toast |
| **Follow CTA** | Newsletter / redes | No agresivo |
| **External Link** | Sale del medio | Icono + `rel` adecuado |

### 2.4 Tipografía & contenido

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Display Title** | Titular hero | Un solo dominante |
| **Article Title** | H1 de noticia/evento | |
| **Section Title** | H2 de bloque | |
| **Dek / Lead** | Bajada | |
| **Body Text / Prose** | Cuerpo tipográfico | Medida `article-max` |
| **Metadata** | Fecha, autor, lectura, ubicación | Composición horizontal/wrap |
| **Byline** | Autor + rol | Con avatar opcional |
| **Caption** | Pie de foto | |
| **Credit** | Crédito fotógrafo | Siempre visible en media |
| **Pull Quote** | Cita destacada | Uso editorial escaso |
| **Rich Text Blocks** | Párrafo, lista, H2/H3, embed | CMS rendering |
| **Code / Pre** | Solo si editorial lo requiere | Raro en medio |

### 2.5 Media

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Editorial Image** | Imagen con aspect + credit | Aspectos: `16/9`, `4/3`, `1/1`, `3/4` |
| **Hero Media** | Imagen/video de portada | Full-bleed o editorial-bleed |
| **Photo Card** | Entrada visual a contenido | Foto dominante + meta mínima |
| **Gallery** | Conjunto de fotos | Grid + lightbox |
| **Lightbox** | Vista ampliada | Teclado, swipe mobile |
| **Video Embed** | YouTube/Vimeo/etc. | Ratio 16/9, lazy |
| **Audio Embed** | Podcast/clip | V2 |
| **Map Embed** | Ubicación de evento | V2 |
| **Avatar** | Persona / org | Circle; sizes sm/md/lg |
| **Cover Image** | Portada de perfil | Organizador / fotógrafo |

### 2.6 Cards & list items

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Article Card** | Entrada a noticia | Variantes: `standard`, `featured`, `compact`, `horizontal` |
| **Event Card** | Entrada a evento | Fecha/hora/lugar visibles |
| **Photo Story Card** | Cobertura visual | Enfatiza galería |
| **Category Card** | Entrada a categoría | |
| **Organizer Card** | Entrada a organizador | Logo/avatar + nombre |
| **Photographer Card** | Entrada a fotógrafo | Portrait + nombre |
| **Agenda Item** | Fila de agenda | Tiempo + título + meta |
| **Search Result Item** | Resultado unificado | Tipo + título + snippet |
| **Related Item** | Relacionado al pie | Compacto |

### 2.7 Clasificación & estado

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Badge** | Etiqueta corta | Status, “En vivo”, “Nuevo” |
| **Category** / **Category Badge** | Categoría editorial | Soft accent |
| **Tag** | Tags libres | Secundario a categoría |
| **Status Pill** | Estado de evento | Programado / En curso / Finalizado |
| **Reading Time** | Minutos de lectura | Parte de Metadata |
| **Live Indicator** | Cobertura en vivo | Uso excepcional |

### 2.8 Hero & modules editoriales

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Hero** | Pieza principal de portada | Variantes: `feature`, `split`, `photo-led` |
| **Featured Rail** | Destacados secundarios | 2–4 items |
| **Section Header** | Título + link “Ver todos” | |
| **Editorial Grid** | Grilla de cards con jerarquía | No mosaico plano |
| **Spotlight** | Bloque de una historia | |
| **Newsletter Block** | Captura de email | Opt-in claro |
| **Quote / Testimonial Block** | Solo si editorial | No marketing vacío |
| **CTA Band** | Cierre de sección | Quiénes somos / contacto |
| **Empty State** | Sin resultados / sin notas | Honest + CTA |
| **Error State** | Error de carga | Calmo + reintento |
| **Skeleton** | Loading placeholder | Sin shimmer agresivo |

### 2.9 Formularios

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Text Field** | Input texto | Altura táctil ≥44px |
| **Text Area** | Mensaje / contacto | |
| **Select** | Selección | |
| **Checkbox / Radio** | Opciones | |
| **Field Label / Hint / Error** | Accesibilidad de form | |
| **Search Filters** | Filtros de resultados | Chip o select |
| **Date Picker** | Filtro de agenda | V2 |
| **File Dropzone** | Solo backoffice | Fuera de scope público MVP si aplica |

### 2.10 Overlays & feedback

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Modal / Dialog** | Confirmaciones / share expandido | Escaso en lectura |
| **Sheet** | Mobile menus / filtros | |
| **Toast** | Feedback breve | Copiar link, errores soft |
| **Tooltip** | Ayuda puntual | No crítico en mobile |
| **Confirm Dialog** | Acciones destructivas | Admin |

### 2.11 Comercio / ecosistema (cuando aplique)

| Componente | Propósito | Notas |
| --- | --- | --- |
| **Album Commerce CTA** | Puente a compra de fotos | No debe romper lenguaje editorial |
| **Partner / Organizer Strip** | Mención de organizador | Discreto |
| **Cross-link to DNX Suite** | Salida al ecosistema | Clara pero no dominante |

### 2.12 SEO / social (no visual, pero de sistema)

| Componente | Propósito | Notas |
| --- | --- | --- |
| **SEO Head** | Title/description/OG | |
| **Open Graph Image** | Share card | Plantilla con logo + titular + foto |
| **JSON-LD** | Article / Event schema | |

---

## 3. Variantes prioritarias (detalle)

### Hero

- **feature:** foto full-bleed + titular + dek + meta  
- **split:** media + texto en dos columnas (desktop)  
- **photo-led:** imagen dominante, texto debajo (mobile-first)

### Article Card

- **featured:** mayor tamaño, foto 16/9, título fuerte  
- **standard:** foto + categoría + título + meta  
- **compact:** sin foto o thumb chico, para listados densos  
- **horizontal:** thumb + texto en fila (md+)

### Button

- **primary:** accent filled  
- **secondary:** borde / surface  
- **ghost:** texto + hover soft  
- **danger:** solo acciones destructivas

### Share

- Copiar enlace  
- Native share (mobile)  
- WhatsApp / X / Facebook / LinkedIn (según mercado)  
- Embebido opcional V2

---

## 4. Estados comunes

Todo componente interactivo debe definir:

- `default`
- `hover`
- `active` / `pressed`
- `focus-visible`
- `disabled`
- `loading` (si async)
- `empty` / `error` (si data-driven)

---

## 5. Do / Don’t de componentes

| Do | Don’t |
| --- | --- |
| Usar Category Badge discreto cerca del título | Superponer badges sobre foto hero |
| Photo Card con crédito | Card con sombra fuerte y borde grueso |
| Metadata tipográficamente secundaria | Metadata en pills de colores múltiples |
| Gallery con lightbox limpio | Carrusel autoplay con dots ruidosos |
| Empty state calmado | Ilustraciones cartoon / emojis |

---

## 6. Mapa de dependencia (alto nivel)

```
Page Shell
├── Header (Logo, Nav, Search, Button, Mobile Nav)
├── Main
│   ├── Hero / Section
│   ├── Editorial Grid → Article/Event/Photo Cards
│   ├── Article View → Title, Dek, Metadata, Media, Prose, Share, Related
│   └── Modules (Newsletter, CTA Band, Empty)
└── Footer
```

---

## Documentos relacionados

- `03-design-system-foundations.md` — tokens  
- `05-layouts.md` — composición de páginas  
- `08-roadmap-ui.md` — cuándo se implementa cada grupo  
