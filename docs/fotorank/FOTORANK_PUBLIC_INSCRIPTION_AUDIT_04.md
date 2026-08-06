# IMPL 04 — Auditoría del flujo de inscripción (lógica vs visual)

**Fecha:** 2026-08-06  
**Rama:** `feat/fotorank-public-inscription-design-01`  
**Base:** `origin/release/fotorank-production` (`808df242`)

## Recorrido real mapeado

Visitante → landing → CTA inscripción → `/login?next=…/inscripcion` → registro opcional → retorno → form (categoría, Instagram SFEF, edad, bases, consentimientos, menores) → confirmación → wizard carga (si CONFIRMED) → requisitos / foto / datos / revisión / confirmación → `/participaciones` · carga cerrada sin CTA activo.

## Tabla de componentes

| Componente | Responsabilidad funcional | Responsabilidad visual | Acción |
| ---------- | ------------------------- | ---------------------- | ------ |
| `inscripcion/page.tsx` | Auth gate, load contest/reg/rules/window, ramas form vs ya-inscripto | Chrome de página | WRAP_ONLY + RESTYLE |
| `InscriptionForm.tsx` | Validación cliente, POST registrations, consents, IG, ARGRA, menores | Formulario | KEEP_LOGIC + RESTYLE |
| `ContestFormField` | a11y label/hint | Fields 10C | RESTYLE vía `public-ui/FormField` |
| `RulesDocument` | Parse bases | Tipografía | KEEP_LOGIC + RESTYLE clases |
| `ParticipantUploadWizard` | Steps, FormData upload/replace/confirm, gates | Wizard 10C | KEEP_LOGIC + RESTYLE clases/CTAs |
| `UploadStepper` / `UploadConfirmModal` | Step index / confirm busy | Stepper/modal | KEEP_LOGIC + RESTYLE |
| APIs `registrations` / `entries/*` | Persistencia + pipeline | — | KEEP_LOGIC |
| `lib/fotorank/registration/*` | Reglas inscripción | — | KEEP_LOGIC |
| `lib/fotorank/participant-upload/*` | Policy, validación archivo | — | KEEP_LOGIC |
| `login/page` + `LoginForm` | `next` + notice | `@repo/auth-ui` en PublicShell | KEEP_LOGIC + WRAP_ONLY |
| `PublicShell` / public-ui | Session chrome | Tokens públicos | KEEP_LOGIC |
| `EntryUploadPanel` | Legacy (huérfano) | — | NO TOCAR |

## Restricciones

Sin cambios en APIs, modelos, migraciones, R2, pipeline, textos legales, obligatoriedad Instagram, promo opt-in, `publicUploadOpen`, datos productivos.
