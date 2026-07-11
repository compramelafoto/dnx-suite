# Info Spot — Plantilla de carga editorial (noticias REAL)

Usar en `/redaccion/nueva` o duplicando un borrador existente.

## Campos obligatorios para publicar

| Campo | Notas |
| --- | --- |
| Título | Claro, sin clickbait vacío |
| Bajada (excerpt) | 1–2 oraciones |
| Cuerpo | Markdown; incluir localidad y contexto del hecho |
| Categoría | Deportes / Cultura / Fotografía / Eventos / … |
| Fecha de publicación | Hora Argentina (`America/Argentina/Buenos_Aires`) |
| Autor | Usuario de redacción logueado |
| Slug | minúsculas-con-guiones |
| Etiqueta | **REAL** (bloquea publicar si no) |

## Campos recomendados

| Campo | Notas |
| --- | --- |
| Fotografía / portada | Upload o asset; con crédito |
| Crédito | En el asset (`credit` / `photographerName`) |
| Fuente | Mencionar en cuerpo o crédito |
| SEO title | ≤ 60 caracteres (contador en formulario) |
| SEO description | ≤ 155 caracteres |
| Fecha del acontecimiento | En el cuerpo si difiere de `publishedAt` |
| Localidad | En bajada o primer párrafo |

## Checklist rápido (20 noticias)

1. Nueva noticia → completar plantilla  
2. Subir portada + crédito  
3. Preview (`/redaccion/noticias/[id]/preview`)  
4. Tag **REAL**  
5. Publicar (solo Director / rol con permiso)  
6. Verificar en `/noticias/[slug]` sin sesión  

## Atajos en panel

- **Duplicar** en listado: copia a borrador `NEEDS_REVIEW`  
- Contadores SEO en el formulario  
- Checklist de publicación en vivo  

## Eventos REAL

En `/admin/eventos/[id]`: completar datos, tag **REAL**, publicar.  
No se puede publicar sin tag REAL. Solo próximos aparecen en “destacados” de Home.
