# ETAPA 16 — Asistente Editorial (inteligencia por reglas)

## Distinción

| Pieza | Ruta | Rol |
|-------|------|-----|
| Wizard de borrador | `/redaccion/asistente` + `lib/editorial-assistant` | Flujo de creación + material CLF |
| **Asistente Editorial (esta etapa)** | Panel en `ArticleForm` + `@repo/editorial-intelligence` | Sugerencias en vivo, no destructivas |

## Panel

- Desktop: rail derecho, pestaña **Asistente** (default) / Material
- Móvil: botón **Asistente** → drawer
- Se actualiza con el estado del formulario (sin modales invasivos)

## Motor

`EditorialAssistantEngine` + `RuleBasedSuggestionProvider` en `packages/editorial-intelligence`.

No usa OpenAI/Claude/etc. Interfaz `EditorialSuggestionProvider` lista para un provider LLM futuro.

## Qué sugiere

Calidad, categoría, etiquetas (sesión), geo, SEO, checklist, duplicados/relacionados (Prisma), convocatoria, banner, enlaces, resumen.

**Nunca** aplica cambios sin clic del editor (excepto palabras clave de sesión locales).
