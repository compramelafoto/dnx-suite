# Carga guiada de fotografías — ETAPA 03 IMPLEMENTACIÓN 02

Rama: `feat/fotorank-super-admin-09b` · Base: `43553fb`

## Estado

**PARTIAL — UI guiada lista; carga productiva de Santa Fe sigue cerrada.**

No declarar operativa la carga real hasta validar storage, permisos, persistencia y flujo E2E en entorno seguro.

## Stash / working tree

WIP previo (`wip-fotorank-etapa03-impl01-final`) ya aplicado. No se reejecutó `stash apply/pop`.

## Arquitectura del flujo

Pasos: **Requisitos → Fotografía → Datos → Revisión → Confirmación**

Componente: `ParticipantUploadWizard`  
APIs (sin cambios de contrato): `upload-intent` → `upload`/`replace` → `confirm`  
Validación cliente (feedback) + validación servidor (autoritativa).

## Rutas

| Ruta | Rol |
|------|-----|
| `/concursos/[slug]/inscripcion` | Wizard live (si inscripción confirmada) |
| `/participaciones/[id]` | Detalle / fase cerrada |
| `/dev/participant-upload-visual-fixture` | Fixture ventana abierta (solo no-production) |

## Reglas reales

Fuente: `uploadPolicyJson` / default draft JPEG 25MB, min 1200×800, 1.5 MP, `maxEntriesPerRegistration` 1.  
Categoría: `maxFiles` real (SFEF = 1).  
Ventana: `resolveUploadWindow` (misma lógica que entry-service).

## Contradicciones documentadas

1. `uploadPolicyJson` puede llevar `draftConfig: true` / marcador BORRADOR — bloqueado en prod por guard, pero UI usa defaults draft en local.
2. Título de obra: campo en schema, **no** persistido por API de upload actual (UI lo marca como no guardado).
3. Preview `/me` puede usar storage local aunque el write vaya a R2 (riesgo previo, no modificado aquí).
4. Textos jurídicos de declaraciones en UI vs bases: no se alteraron; cualquier desvío debe revisión legal aparte.

## Borradores

No hay autoguardado de metadatos en servidor sin archivo. Datos de formulario viven en sesión del cliente; `beforeunload` advierte si hay cambios.

## Enviar ≠ Admitir

Copy de confirmación y labels públicos lo dejan explícito.

## Fixture

`/dev/participant-upload-visual-fixture` → `notFound()` en production (`NODE_ENV === "production"`). Escenarios: requisitos, foto válida/inválida, datos, revisión, confirmación, corrección, error.

**Importante (cliente):** el wizard y `requirements.ts` no deben importar el barrel `participant-experience` (arrastra Prisma vía `load-participations`). Usar rutas profundas (`dates`, `upload-window`, `category-semantics`).

## Seguridad

Ownership y ventana se validan en API. Fixture no llama storage real. No se exponen ARGRA, keys ni URLs privadas nuevas.

## Validación visual (local)

Capturas en `.tmp/fotorank-etapa03-impl02-visual/` + `capture-report.json`.

- Real cerrado SFEF: 1440 / 768 / 390 — `hasClosed=true`, `hasDropzone=false`.
- Fixture abierto: 8 escenarios × (1440 + 390) — banner FIXTURE presente.
- Page errors: 0. Overflow horizontal: 0 en capturas.

## Antes de abrir carga real

- Validar policy no-draft en staging.
- Probar upload+preview con R2.
- Persistencia de título/descripción si producto lo requiere.
- E2E con archivo real y confirm.
- Notificaciones de apertura (si aplica).
- Revisión legal de copy de declaraciones vs bases.

## Selfcheck

```bash
pnpm --filter fotorank test:participant-upload:selfcheck
```

## Capturas

`.tmp/fotorank-etapa03-impl02-visual/`
