# Plantillas iniciales Clickatón

## Fuente de verdad (Etapa 08)

Los presets oficiales viven en:

```text
@repo/template-engine/clickaton-presets
packages/template-engine/src/presets/clickaton/
```

API: `CLICKATON_WELCOME_STORY_V1`, `CLICKATON_MEMBER_STORY_V1`, `getClickatonTemplatePreset`, `listClickatonTemplatePresets`, `instantiateClickatonTemplatePreset`.

ComprameLaFoto (`lib/template-v2/presets/clickaton/*`) y Clickatón (`lib/participant-cards/participant-card-presets.ts`) **re-exportan** estas definiciones; no mantener copias locales del documento visual.

## CLICKATON_WELCOME_STORY_V1

- Formato: Instagram Story **1080×1920**
- Mensaje: ¡BIENVENID@ A CLICKATÓN!
- Preset ID: `clickaton-welcome-story-v1`
- Requiere: `participant.fullName`, `participant.photoUrl`, `edition.name` (+ fecha recomendada)
- Instagram: opcional (bloque oculto si vacío / no muestra `@`)

## CLICKATON_MEMBER_STORY_V1

- Formato: Instagram Story **1080×1920**
- Mensaje: SOY PARTE DE CLICKATÓN
- Preset ID: `clickaton-member-story-v1`
- Prioriza pertenencia + `card.message`
- Instagram opcional

## Identidad

- Amarillo `#FFE600` · Negro `#000000` · Blanco `#FFFFFF` · Violeta `#3B1F6E`
- Tipografías: Barlow Condensed / DM Sans (fallback sistema en preview)

## Metadata

```ts
{
  product: "clickaton",
  templateKey: "CLICKATON_WELCOME_STORY_V1" | "CLICKATON_MEMBER_STORY_V1",
  templateVersion: 1,
  format: "instagram_story",
  purpose: "participant_welcome" | "participant_member",
  official: true
}
```

## Instanciación

`instantiatePresetPayload` copia el documento con IDs nuevos; el preset versionado en repo no se muta.

Editor: Nueva plantilla → Plantillas oficiales → Clickatón.

## Foto ausente

Preview: placeholder / bloque vacío; no crash. Render final futuro podrá exigir foto.

## Versionado

Bump `templateVersion` / nuevo `templateKey` ante cambios incompatibles. No IDs de DB fijos en presets.
