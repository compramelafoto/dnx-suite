# 38 — Superficie de escritura (editor concentrado)

## Principio

| Fase | Dónde |
|------|--------|
| Preparación | `/redaccion/asistente` |
| Escritura | `/redaccion/noticias/[id]/editar` |

El editor no es un panel administrativo. Es una aplicación de escritura que **consume** el material del asistente.

## Layout

```
[Header shell: Volver · Focus]
[Toolbar form: autosave · Material · Configuración · Preview · Guardar]
┌─────────────────────────────┬──────────────────────┐
│ Título / Bajada / TipTap    │ Biblioteca lateral   │
│ (columna de escritura)      │ Evento · coberturas  │
│                             │ ★ Portada            │
│                             │ ▣ Galería            │
│                             │ ¶ Insertar al texto  │
└─────────────────────────────┴──────────────────────┘
         Configuración → drawer (SEO, publicación, CLF…)
```

- Nav izquierda: oculta en focus (ya existente).
- Biblioteca visible desde `lg`.
- En móvil: drawers con tabs Material | Configuración.
- Escape cierra drawers.

## Qué quedó fuera de la columna central

- `ClfEventPicker` completo → Configuración → Material avanzado
- SEO, slug, categoría, fuente → Configuración → Metadatos / SEO
- `EditorialActionsPanel` → Configuración → Publicación
- `CoverImageField` avanzado → Configuración → Portada avanzada
- `PublishChecklist` → Configuración → Checklist

## Biblioteca

`MaterialLibraryPanel` usa `clf.linkedAssets` ya cargados. No reimplementa el selector de fotos.

Acciones rápidas:

- **Insertar** en fotos INLINE → TipTap vía `EditorialVisualEditorHandle.insertImage`
- **Agregar material** → deep link al asistente (`mode=photos`)

## Archivos

| Archivo | Rol |
|---------|-----|
| `article-form.tsx` | Layout concentración |
| `material-library-panel.tsx` | Biblioteca contextual |
| `editor-config-accordion.tsx` | Paneles admin colapsables |
| `editorial-visual-editor.tsx` | `forwardRef` + insert desde biblioteca |

## Restricciones respetadas

Sin cambios de workflow, Prisma, sync CLF, ContentOrigin, ni reimplementación del asistente.
