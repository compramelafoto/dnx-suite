# Design System — ComprameLaFoto

Tokens y utilidades en `styles/design-system/`. Componentes base en `components/ui/`.

## Referencia visual (local)

Ruta interna **`/design-system`** (solo `development` o `DESIGN_SYSTEM_ENABLED=1` en producción).

- Overview: `/design-system`
- Botones: `/design-system/buttons`
- Formularios: `/design-system/forms`

## Reglas mínimas de UI

- **Botones principales:** mínimo 44px de alto (`size="md"` por defecto en `Button`).
- **Botones compactos:** `size="sm"` (40px) solo en toolbars o acciones secundarias densas.
- **Inputs y selects:** mínimo 44px de alto; clase `.ds-form-control` o componentes `Input` / `Select`.
- **Textareas:** mínimo 4 líneas visibles (`min-height: 5.5rem`); componente `Textarea`.
- **CTAs de formularios y checkout:** no usar `size="sm"`.
- **Modales:** `AppModal` — `sm` ≈ 640px en desktop; cuerpo con `.ds-modal-scroll`; botón cerrar 44×44px.
- **Campos:** ocupar 100% del contenedor salvo casos justificados (p. ej. `input[type="color"]`).

## Componentes base (Fase 0)

| Componente | Archivo | Notas |
|------------|---------|--------|
| Button | `components/ui/Button.tsx` | `sm` 40px · `md` 44px · `lg` 48px |
| Input | `components/ui/Input.tsx` | `rounded-2xl`, `ds-form-control` |
| Select | `components/ui/Select.tsx` | Mismo criterio visual que Input |
| Textarea | `components/ui/Textarea.tsx` | `resize-y`, prop opcional `error` |
| AppModal | `components/ui/AppModal.tsx` | Tamaños `sm`–`xl` |

## CSS de formularios

`forms.css` define `.ds-field`, `.ds-form-grid`, `.ds-form-control` y variantes `.ds-input`, `.ds-select`, `.ds-textarea`.

## Ancho de layout (evitar columnas finas)

| Caso | Clase / token | Tope |
|------|----------------|------|
| Prosa / formularios cuenta | `.ds-account-inner` | ~54rem |
| Texto legible | `.ds-readable-text` | ~50rem (ch) |
| Paneles fotógrafo / admin | `.ds-dashboard-inner` | 80rem |
| **Galerías y centros de descarga** | `.ds-gallery-inner` + `.ds-gallery-grid` | **72rem** |

**No** usar `max-w-3xl` / `max-w-prose` en páginas de fotos. Patrón recomendado:

```tsx
<main className="ds-page-shell">
  <div className="container-custom">
    <div className="ds-gallery-inner ds-stack-section">
      {/* header, cards, etc. */}
      <ul className="ds-gallery-grid">…</ul>
    </div>
  </div>
</main>
```

## Blog público

- Shell: `BlogPageShell` (`components/blog/BlogPageShell.tsx`) con variantes `list` y `article`.
- Tokens: `--ds-blog-inner-max`, `--ds-blog-article-max`, `--ds-blog-accent` en `tokens.css`.
- Estilos: `blog-article.css` — clases `.blog-*` para layout, tarjetas, chips y cuerpo `.blog-article-body`.
