# Info Spot — Layouts

**Versión:** 1.0  
**Estado:** Guía oficial de layouts de página  
**Alcance:** Solo documentación. **No implementar** layouts en este entregable.

---

## 1. Principios de layout

- Una composición editorial por viewport, no un dashboard.
- Jerarquía: un dominante + secundarios claros.
- Fotografía con espacio real; tipografía con medida controlada.
- Sidebars densas: evitadas en MVP.
- Full-bleed solo para media hero, no para texto.
- Cada página tiene un trabajo principal.

---

## 2. Home

### Trabajo

Ser la portada del medio: mostrar qué importa ahora y guiar a lectura/agenda.

### Estructura

1. **Header**
2. **Hero** (historia principal: media + título + dek + meta + CTA “Leer”)
3. **Featured rail** (2–4 destacados secundarios)
4. **Secciones por categoría / cobertura** (grids con Section Header)
5. **Agenda / próximos eventos** (módulo compacto)
6. **Bloque editorial de cierre** (quiénes somos / newsletter)
7. **Footer**

### Composición

| Zona | Mobile | Desktop |
| --- | --- | --- |
| Hero | Stack: media → texto | Feature o split; media dominante |
| Featured | Stack vertical | 2–4 columnas o 1+2 |
| Categorías | 1 col cards | 2–3 cols con 1 featured opcional |
| Agenda | Lista | Lista o 2 cols |

### No hacer

- Grilla uniforme de 9–12 cards iguales sin hero.
- Widgets de clima/stats/social counters.
- Carrusel autoplay como pieza principal.
- Sidebar de “más leídas” ruidosa en el primer viewport.

---

## 3. Noticia (artículo)

### Trabajo

Entregar una experiencia de lectura limpia, con contexto y continuidad.

### Estructura

1. Breadcrumb / Category  
2. Article Title (H1)  
3. Dek  
4. Metadata (fecha, autor, tiempo de lectura)  
5. Hero image + credit  
6. Prose (cuerpo)  
7. Gallery / embeds (si hay)  
8. Share  
9. Relacionados  
10. CTA suave (contacto / newsletter / organizador)  
11. Footer

### Composición

- Columna de lectura centrada (`article-max` ~720px).
- Media principal puede expandirse a `media-max`.
- Sin sidebar de ads o widgets en MVP.
- Ancho tipográfico estable en todos los breakpoints.

### Variantes

- **Standard:** texto + imagen principal  
- **Photo story:** más peso en gallery  
- **Brief:** nota corta, sin gallery

---

## 4. Evento

### Trabajo

Informar qué, cuándo, dónde y por qué importa; conectar con cobertura y organizador.

### Estructura

1. Breadcrumb  
2. Status (programado / en curso / finalizado)  
3. Título del evento  
4. Metadata clave (fecha, hora, lugar)  
5. Media / cover  
6. Descripción editorial  
7. Detalles prácticos (agenda del día, acceso, links)  
8. Organizador (card/link)  
9. Cobertura relacionada (noticias / fotos)  
10. CTA ecosistema (álbum / tickets si aplica, sin romper editorial)  
11. Share + Footer

### Composición

| Zona | Mobile | Desktop |
| --- | --- | --- |
| Header del evento | Stack | Título + meta sticky opcional |
| Detalles | Lista | 2 cols (descripcion + facts) |
| Cobertura | Cards stack | Grid 2–3 |

### No hacer

- Parecer ficha de CRM.
- Priorizar botones de compra sobre la historia del evento.

---

## 5. Categoría

### Trabajo

Explorar un eje temático con identidad clara y listado legible.

### Estructura

1. Header de categoría (nombre + descripción corta)  
2. Opcional: destacado de la categoría  
3. Grid/listado de Article Cards  
4. Paginación  
5. Footer

### Composición

- Intro compacta, no hero monumental salvo campaña.
- 1 col mobile → 2–3 cols desktop.
- Filtros mínimos en MVP (orden por fecha).

---

## 6. Organizador

### Trabajo

Presentar al organizador como actor del ecosistema y su actividad editorial.

### Estructura

1. Cover / avatar + nombre  
2. Bio corta  
3. Metadata (ubicación, links, redes)  
4. Próximos eventos  
5. Noticias / coberturas asociadas  
6. CTA de contacto o sitio (externo)  
7. Footer

### Composición

| Zona | Mobile | Desktop |
| --- | --- | --- |
| Perfil | Stack | 3–4 cols perfil + 8–9 contenido |
| Eventos/Notas | List/grid | Grid |

### Lenguaje

- Perfil editorial, no página de empresa SaaS.
- Evitar dashboards de métricas del organizador en la vista pública.

---

## 7. Fotógrafo

### Trabajo

Dar protagonismo al autor visual y a su cobertura.

### Estructura

1. Portrait / avatar + nombre  
2. Bio corta  
3. Especialidad / créditos  
4. Gallery destacada  
5. Coberturas / eventos asociados  
6. Link a álbumes / ecosistema (si aplica)  
7. Footer

### Composición

- La galería es el centro, no el texto.
- Grid fotográfico generoso; captions/créditos consistentes.
- Evitar look de portfolio template genérico con animaciones excesivas.

---

## 8. Agenda

### Trabajo

Permitir escanear qué pasa y cuándo, con entrada rápida al evento.

### Estructura

1. Título “Agenda” + intro breve  
2. Controles (rango temporal / filtros básicos)  
3. Lista de Agenda Items agrupados por día  
4. Empty state si no hay eventos  
5. Footer

### Composición

| Zona | Mobile | Desktop |
| --- | --- | --- |
| Controles | Stack / sheet filtros | Inline |
| Lista | Timeline vertical | Timeline o 2 cols día+items |

### No hacer

- Calendario tipo Google Calendar denso como vista default.
- Codificación por colores excesiva.

> **Punto abierto:** vista calendario mensual vs lista por día como default MVP.

---

## 9. Búsqueda

### Trabajo

Encontrar rápido noticias, eventos, organizadores y fotógrafos.

### Estructura

1. Search Box (query visible)  
2. Filtros por tipo (todo / noticias / eventos / personas)  
3. Result list (Search Result Item)  
4. Empty / no results  
5. Footer

### Composición

- Query + filtros arriba; resultados en una columna legible.
- Cada resultado muestra tipo, título, snippet/meta y, si aporta, thumb.
- Sin “discovery widgets” que distraigan del query.

### Estados

- Idle (sin query): sugerencias editoriales mínimas o categorías.
- Loading: skeletons sobrios.
- No results: mensaje claro + atajos a home/agenda.

---

## 10. Layouts de soporte (referencia)

No son el foco de este doc, pero deben coherer:

| Página | Nota |
| --- | --- |
| Quiénes somos | Editorial, una columna + aside suave |
| Contacto | Formulario limpio, sin marketing agresivo |
| 404 | Calmo, con links útiles |
| Legal / privacidad | Tipografía de lectura, sin adornos |

---

## 11. Wireframe textual (home)

```
[ Logo ........ Nav ........ Search  CTA ]
[ HERO MEDIA (full / dominant)           ]
[ Title / Dek / Meta / Leer              ]
[ Featured | Featured | Featured         ]
[ Sección Categoría A                    ]
[ Card  Card  Card                       ]
[ Agenda                                 ]
[ Item  Item  Item                       ]
[ Newsletter / Cierre                    ]
[ Footer                                 ]
```

---

## Documentos relacionados

- `02-editorial-language.md` — sensación y jerarquía  
- `04-component-library.md` — piezas usadas  
- `06-responsive.md` — adaptación por viewport  
