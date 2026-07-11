# Info Spot — Roadmap UI

**Versión:** 1.0  
**Estado:** Roadmap oficial de UI (documentación)  
**Alcance:** Planificación. **No implementar** en este entregable. **No commits.**

---

## 1. Objetivo del roadmap

Traducir la identidad visual y editorial de Info Spot en una UI coherente, por fases, sin romper el lenguaje de medio digital moderno.

Cada fase debe poder validarse con:

- Coherencia con Brand Book + Editorial Language
- Lectura usable en mobile/desktop
- Accesibilidad mínima
- Performance aceptable en LCP de heroes

---

## 2. MVP — Fundación editorial pública

**Meta:** Portada y lectura creíbles como medio. Identidad visible. Sin look de blog/dashboard.

### Alcance UI

| Área | Entregables |
| --- | --- |
| Brand | Logo wordmark/mark en header/footer; favicon |
| Foundations | Tokens color/tipo/spacing/radius/shadow/containers aplicados de forma consistente |
| Shell | Header, Mobile Nav, Footer, Section, Container |
| Home | Hero + featured + secciones de cards + módulo agenda simple + cierre |
| Noticia | Título, dek, metadata, imagen, prose, share básico, relacionados |
| Categoría | Header + listado + paginación |
| Agenda | Lista por día + Event cards/items |
| Evento | Ficha editorial (fecha/lugar/descripcion/organizador/cobertura) |
| Búsqueda | Query + resultados unificados básicos |
| Estados | Empty, error, skeleton sobrio |
| Legal/soporte | Quiénes somos, contacto (form básico), 404 |

### Componentes MVP (prioridad)

- Logo, Header, Footer, Mobile Navigation  
- Hero, Article Card (featured/standard/compact), Photo Card  
- Metadata, Category Badge, Button, Share (copy + native)  
- Editorial Image, Section Header, Editorial Grid  
- Agenda Item, Event Card  
- Search Box, Search Result Item  
- Empty State, Newsletter Block (si hay backend), Breadcrumb  

### Fuera de MVP

- Lightbox avanzado / galleries complejas  
- Perfiles ricos de fotógrafo/organizador (pueden existir páginas mínimas)  
- Filtros avanzados y autocomplete  
- Dark mode  
- Personalización / paywall / comentarios  
- Animaciones elaboradas  

### Criterios de salida MVP

- [ ] Home no parece template WordPress ni dashboard  
- [ ] Artículo se lee con medida cómoda y crédito visible  
- [ ] Logo y acento usados correctamente  
- [ ] Mobile nav usable  
- [ ] Agenda y búsqueda resuelven wayfinding básico  
- [ ] QA responsive checklist (`06-responsive.md`) en verde  

---

## 3. V2 — Profundidad editorial y personas

**Meta:** Expandir el mundo narrativo (fotógrafos, organizadores, galleries) y pulir discovery.

### Alcance UI

| Área | Entregables |
| --- | --- |
| Fotógrafo | Perfil + gallery destacada + coberturas |
| Organizador | Perfil editorial + eventos + notas |
| Gallery | Grid + Lightbox + créditos por foto |
| Home | Composiciones asimétricas más ricas; photo-led modules |
| Búsqueda | Filtros por tipo, suggestions |
| Agenda | Filtros (categoría/lugar) + posible vista calendario |
| Artículo | Pull quotes, anchors, embeds mejorados, related más inteligentes |
| Share | Redes + OG image template consistente |
| Motion | 2–3 motions de marca documentadas e implementadas |
| Accesibilidad | Auditoría y correcciones |

### Componentes V2

- Gallery, Lightbox  
- Photographer Card / page modules  
- Organizer Card / page modules  
- Tabs, Filters, Search Suggestions  
- Pull Quote, Anchor Nav  
- Status Pill / Live Indicator (si hay cobertura en vivo)  
- Toast system unificado  
- OG Image template  

### Criterios de salida V2

- [ ] Fotografía es protagonista en perfiles y stories  
- [ ] Discovery (search/agenda) más preciso sin ruido  
- [ ] Motion sutil y coherente  
- [ ] Share/OG alineados a marca  

---

## 4. V3 — Ecosistema, escala y excelencia

**Meta:** Conectar el medio con el ecosistema DNX con elegancia; escalar contenido y calidad percibida.

### Alcance UI

| Área | Entregables |
| --- | --- |
| Ecosistema | Cross-links refinados a Suite / álbumes / comercio sin romper editorial |
| Personalización | Seguimiento de categorías/organizadores (si producto lo define) |
| Contenido rico | Video/audio modules, mapas de evento, specials/landings editoriales |
| Design system | Librería documentada + storyboard/catalog interno |
| Tipografía | Posible introducción de display/serif editorial definitiva |
| Internacionalización | Si aplica (ES variantes / EN) |
| Performance | Image CDN patterns, route-level optimizations |
| Experimentación | Tests A/B de portada con guardrails de marca |

### Componentes V3

- Video/Audio embeds de primer nivel  
- Map Embed  
- Follow system UI  
- Special landing modules  
- Advanced commerce bridge (editorial-safe)  
- Design tokens package publicable dentro del monorepo  

### Criterios de salida V3

- [ ] Info Spot se percibe como medio de referencia del ecosistema  
- [ ] Puentes a producto no contaminan la lectura  
- [ ] Sistema de diseño estable y reutilizable  
- [ ] Identidad tipográfica/visual cerrada (sin puntos abiertos críticos)  

---

## 5. Priorización (MoSCoW resumido)

| Must (MVP) | Should (V2) | Could (V3) |
| --- | --- | --- |
| Shell + tokens | Gallery + lightbox | Follow / personalización |
| Home + artículo | Perfiles fotógrafo/org | Landings specials |
| Categoría + agenda + evento | Search filters | Video/audio rich |
| Búsqueda básica | Motion de marca | i18n |
| Share básico | OG templates | Token package |

---

## 6. Dependencias no-UI

El roadmap de UI asume progreso paralelo en:

- Modelo de contenido (noticia, evento, categoría, personas, media)
- CMS / fuentes de datos
- Assets de marca finales (logo mono, guidelines PDF si aplica)
- Performance de imágenes
- Analytics mínimo

> **Punto abierto:** alinear este roadmap UI con el roadmap de producto/contenido de Info Spot.

---

## 7. Gobernanza

- Estos docs en `docs/infospot/` son la guía oficial.
- Cambios de identidad requieren actualizar Brand Book + Foundations.
- Ningún componente nuevo debería introducirse sin entrada en `04-component-library.md`.
- Excepciones temporales de MVP deben listarse explícitamente (deuda visual).

---

## 8. Deuda visual conocida (plantilla)

Usar esta tabla al implementar:

| Ítem | Fase origen | Riesgo | Plan |
| --- | --- | --- | --- |
| Ejemplo: tipografía display pendiente | MVP | Medio | Evaluar en V2/V3 |
| Ejemplo: perfiles mínimos | MVP | Bajo | Expandir en V2 |

---

## Documentos relacionados

- `01-brand-book.md`  
- `02-editorial-language.md`  
- `03-design-system-foundations.md`  
- `04-component-library.md`  
- `05-layouts.md`  
- `06-responsive.md`  
- `07-ux-principles.md`  
