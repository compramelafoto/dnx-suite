# Clickaton ↔ FotoRank — contrato de integración

Documento de contrato funcional. **No es un schema de API final.**  
Etapas: **05** (ficha + consignas) · **05A** (contratos satélite, sin UI).

## 1. Principio

| Sistema | Rol |
|---------|-----|
| **Clickaton** | Marca pública, presentación, navegación, SEO, comunidad editorial |
| **FotoRank** | Fuente de verdad operativa de cada edición |
| **DNX Identity** | Autenticación / cuenta (futuro) |
| **DNX Payments** | Cobros y liquidaciones (futuro) |
| **ComprameLaFoto** | Venta fotográfica (ecosistema hermano; galería comercial futura) |

```
FotoRank (datos públicos aprobados)
  → Clickaton presenta /maratones/[slug]
  → CTA inscripción → flujo FotoRank + DNX Identity
  → pagos → DNX Payments
  → resultados / galería → contratos satélite
  → compra de fotos ganadoras (futuro) → ComprameLaFoto
```

---

## 2. Arquitectura de contratos (Etapa 05A)

**Regla:** no convertir `PublicMarathon` en una interfaz gigante.

| Capa | Responsabilidad | Ubicación |
|------|-----------------|-----------|
| Estructural | Identidad, territorio, estados resumidos, editorial de ficha | `types/marathon.ts` → `PublicMarathon` |
| Satélite | Inscripción, cupos, resultados, galería, capacidades, avisos… | `types/public/*` |

```
PublicMarathon          → ficha estructural
PublicRegistrationOffer → caja / CTA de inscripción
RegistrationEligibility → usuario autenticado
ParticipantRegistrationSummary → “mi inscripción”
PublicMarathonCapabilities → botones / acciones visibles
PublicCapacity / PublicCategoryCapacity → cupos
PublicScheduleWindow → ventanas operativas
PublicValidationRule → reglas públicas de validación
PublicRulesVersion → versionado / aceptación de bases
PublicEventNotice → contingencias y avisos
PublicMarathonResults → resultados
PublicMarathonGallery / PublicGalleryImage → galería
```

### 2.1 Qué consume cada pantalla (futuro)

| Pantalla / bloque | Contrato(s) |
|-------------------|-------------|
| Listado `/maratones` | `PublicMarathon[]` (resumen) |
| Ficha `/maratones/[slug]` | `PublicMarathon` (+ notices, windows, capacity opcionales) |
| Caja de inscripción | `PublicRegistrationOffer` + `PublicMarathonCapabilities` |
| CTA según usuario | `RegistrationEligibility` (Identity) |
| Mi inscripción / acreditación | `ParticipantRegistrationSummary` |
| Resultados | `PublicMarathonResults` |
| Galería | `PublicMarathonGallery` |
| Compra de foto | `PublicGalleryImage.purchaseUrl` → ComprameLaFoto |
| Bases / aceptación | `PublicRulesDocument` (ficha) + `PublicRulesVersion` |

### 2.2 Qué depende del usuario

- `RegistrationEligibility`
- `ParticipantRegistrationSummary`
- Parte de `PublicMarathonCapabilities` (p. ej. `canUploadPhotos`, `canDownloadCertificate`) cuando el evaluador conozca sesión

### 2.3 Qué depende del estado del evento

- `PublicMarathon.status` / `registrationStatus`
- `PublicMarathonCapabilities`
- `PublicRegistrationOffer.mode`
- `PublicScheduleWindow` (apertura/cierre)
- `PublicEventNotice` (activo en ventana)
- Visibilidad de consignas (`PublicChallenge` + filtro)

### 2.4 Qué depende de resultados

- `PublicMarathonResults`
- `PublicMarathon.resultsStatus` (resumen en ficha)
- `canViewResults` / `canDownloadCertificate` en capabilities
- Premios adjudicados (`awards`) vs premios anunciados (`PublicMarathon.prizes`)

### 2.5 Qué depende de ComprameLaFoto

- `PublicGalleryImage.purchaseUrl`
- `commercialAvailability`
- `PublicMarathonCapabilities.canBuyWinningPhotos`

Sin integración en esta etapa.

### 2.6 Qué depende de DNX Payments

- `PublicRegistrationOffer.requiresPayment`, precios, moneda
- `ParticipantRegistrationSummary.paymentStatus`

Sin Mercado Pago ni checkout en Clickaton todavía.

### 2.7 Qué depende de DNX Identity

- `PublicRegistrationOffer.requiresAuthentication`
- `RegistrationEligibility`
- Sesión para “mi inscripción” y capabilities personalizadas

---

## 3. Matriz de consumo

```
PublicMarathon
  ↓
Ficha pública

PublicRegistrationOffer
  ↓
Caja de inscripción

RegistrationEligibility
  ↓
Usuario autenticado

ParticipantRegistrationSummary
  ↓
Mi inscripción

PublicMarathonCapabilities
  ↓
Botones visibles

PublicCapacity / PublicCategoryCapacity
  ↓
Cupos / waitlist

PublicMarathonResults
  ↓
Resultados

PublicMarathonGallery
  ↓
Galería

PublicEventNotice
  ↓
Avisos / contingencias

PublicScheduleWindow
  ↓
Ventanas (inscripción, check-in, captura, subida, …)

PublicRulesVersion
  ↓
Versionado / aceptación de bases

PublicValidationRule
  ↓
Detalle de validaciones públicas
```

---

## 4. Consumo futuro (conceptual — sin endpoints)

```
Listado público
  ↓  PublicMarathon[]

Ficha
  ↓  PublicMarathon
  ↓  PublicEventNotice[]?
  ↓  PublicScheduleWindow[]?
  ↓  PublicCapacity?

Oferta inscripción
  ↓  PublicRegistrationOffer

Elegibilidad
  ↓  RegistrationEligibility   (requiere Identity)

Capacidades
  ↓  PublicMarathonCapabilities

Resultados
  ↓  PublicMarathonResults

Galería
  ↓  PublicMarathonGallery

Mi inscripción
  ↓  ParticipantRegistrationSummary
```

No crear route handlers, OpenAPI ni adaptadores en 05A.

---

## 5. Recurso estructural: `PublicMarathon`

Tipos: `apps/clickaton/types/marathon.ts`.

### Identidad

- `id`, `slug`, `name`, `editionName`
- `shortDescription`, `fullDescription`
- `featured`, `isDemo` (fixtures técnicos)

### Estados resumidos

- `status`, `registrationStatus`
- `resultsStatus`, `galleryStatus` → payloads en contratos satélite

### Territorio y tiempo

- `city`, `provinceOrRegion`, `country`
- `venueName`, `meetingPoint`
- `timezone`, `startAt`, `endAt`
- `registrationOpenAt` / `registrationCloseAt` (**transicional** → `PublicScheduleWindow`)

### Participación (estructural)

- `format`, `modality`, `allowedDevices`, `minimumAge`
- `participantLimit` (**transicional** → `PublicCapacity`)
- `categories[]`
- `rules?`, `validationPolicy?` (+ `rules[]` tipadas opcionales)

### Contenido de ficha

- `schedule[]`, `prizes[]`, `jury[]`, `sponsors[]`, `faq[]`
- `organizer`, `localVenue`
- `accessibilityNotes`, `contactInfo`, `socialLinks`
- `coverImage`, `galleryPreview` (**transicional**)

### Consignas

- `challenges[]` — ver §7

---

## 6. Contratos satélite (Etapa 05A)

| Modelo | Archivo | Notas |
|--------|---------|--------|
| `PublicRegistrationOffer` | `types/public/registration.ts` | CTA/caja; sin calcular precios |
| `RegistrationEligibility` | idem | Por usuario; sin consultar aún |
| `ParticipantRegistrationSummary` | idem | Incluye `qrAvailable` sin generar QR |
| `PublicMarathonCapabilities` | `types/public/capabilities.ts` | Flags de acción |
| `PublicCapacity` | `types/public/capacity.ts` | Cupo global |
| `PublicCategoryCapacity` | idem | Cupo por categoría (opcional) |
| `PublicMarathonResults` | `types/public/results.ts` | Rankings/menciones/awards |
| `PublicMarathonGallery` | `types/public/gallery.ts` | Contenedor |
| `PublicGalleryImage` | idem | Incluye consentimiento y venta futura |
| `PublicValidationRule` | `types/public/validation.ts` | GPS, EXIF, horario, etc. |
| `PublicScheduleWindow` | `types/public/schedule-window.ts` | Ventanas operativas |
| `PublicRulesVersion` | `types/public/rules-version.ts` | Versión + hash opcional |
| `PublicEventNotice` | `types/public/notices.ts` | Contingencias |

Barrel: `types/public/index.ts`.

---

## 7. Seguridad de consignas (obligatorio)

Clickaton **nunca** debe mostrar consignas no liberadas.

Condiciones (`lib/challenges.ts`):

1. `revealed === true`
2. `status` ∈ `{ released, closed }`
3. `title` no vacío

Reglas de producto:

- FotoRank puede enviar consignas programadas sin texto.
- Texto con `revealed=false` se descarta.
- No cachear consignas ocultas en HTML indexable.

---

## 8. Cronograma e ítems

- `PublicScheduleItem` con `publicBeforeEvent=false` oculto antes del evento.
- Ventanas finas: `PublicScheduleWindow` (`registration`, `check_in`, `challenges`, `capture`, `upload`, `judging`, `results`, …).

---

## 9. Validaciones

- Resumen: `PublicValidationPolicy` en ficha.
- Detalle: `PublicValidationRule[]`.
- Ejecución GPS/EXIF/tiempo: FotoRank. Clickaton no procesa metadatos crudos.

---

## 10. Inscripción, Identity y Payments

Clickaton **no** implementa aún formularios, checkout ni webhooks.

Flujo futuro:

1. `PublicRegistrationOffer` + `canRegister`
2. Si `requiresAuthentication` → DNX Identity
3. Si `requiresPayment` → DNX Payments
4. Confirmación → `ParticipantRegistrationSummary`

---

## 11. Qué no debe viajar a Clickaton

- Criterios internos de jurado no publicados
- Datos personales de terceros no autorizados
- Consignas no liberadas (contenido)
- Condiciones económicas de sedes/sponsors no aprobadas
- Credenciales, paneles, secretos
- Precios no confirmados / no publicados en la oferta

---

## 12. Adaptador futuro (no implementado)

```
FotoRank public DTOs
  → mapToPublicMarathon()
  → mapToPublicRegistrationOffer()
  → mapToPublicMarathonResults()
  → …
```

Hoy: `content/demo-marathon.ts` + `lib/marathons.ts` (solo estructural).

---

## 13. Ruta demo

- `/maratones/demo` · `isDemo: true` · noindex · fuera del nav
- No consume aún los contratos satélite (solo tipos)

---

## 14. Checklist FotoRank (ampliado 05A)

- [ ] `PublicMarathon` estructural completo
- [ ] `PublicRegistrationOffer` cuando haya inscripción
- [ ] `PublicCapacity` / `PublicCategoryCapacity` si se publican cupos
- [ ] `PublicScheduleWindow` además de start/end
- [ ] `PublicValidationRule` + policy
- [ ] `PublicRulesVersion` si hay aceptación
- [ ] `PublicEventNotice` para contingencias
- [ ] `PublicMarathonCapabilities` coherente con estado
- [ ] Consignas filtrables
- [ ] `PublicMarathonResults` solo si publicados
- [ ] `PublicMarathonGallery` con consentimiento
- [ ] Contratos de usuario solo con Identity

---

## 15. Pendientes abiertos

- OpenAPI / tRPC / route handlers
- Adaptadores FotoRank → contratos públicos
- URL canónica de inscripción
- Evaluación real de `RegistrationEligibility` y capabilities
- Payload vivo de resultados y galería
- Webhooks de cambio de estado
- Indexación por edición
- Integración ComprameLaFoto / Payments / Identity
- Migrar UI de campos transicionales a contratos satélite
