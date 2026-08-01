# DNX Partners — Mapa de integración por aplicación

**Fecha:** 2026-08-01  
**Etapa:** 00 / Implementación 01

---

## 1. Visión de consumo

```
                         DnxPartner (1×)
                         ficha canónica
                               |
         +---------------------+---------------------+
         |                     |                     |
 Participation           Participation         Participation
 Clickatón edición       FotoOffice / SFPR     FotoRank concurso
         |                     |                     |
 Contributions           Benefits + Audience   Contributions PRIZE
 + display público       (elegibilidad)        + sponsorsText bridge
```

---

## 2. Clickatón

### Estado actual

- `/admin/sponsors` = placeholder.
- Marketing: `/formar-parte`, founding allies, contacto `aliados`.
- Público: `MarathonSponsors` / `PublicSponsor` (hoy vacío desde Prisma).
- Promos: CRUD real `@repo/promotions`.
- Premios: `ClickatonPrizeBundle` con `sponsor` string.
- “Partner” en finanzas = MP connect (otro dominio).

### Integración propuesta

| Fase | Qué |
|------|-----|
| A | Admin CRUD Partner + Participation (edición / sede / categoría) |
| A | Display público desde participaciones `visibility=PUBLIC` |
| B | Contributions PRIZE → soft-link o migración gradual desde `ClickatonPrizeBundle.sponsor` |
| B | Benefit + link opcional a `DnxPromotion` |
| C | PaymentTerms manual si `requiresPayment` |
| — | **No** mezclar con UI `/admin/finanzas/mi-cuenta` partner MP |

### Archivos que tocaría la siguiente implementación (Clickatón)

```
apps/clickaton/app/admin/(panel)/sponsors/**          # reemplazar placeholder
apps/clickaton/config/admin/navigation.ts             # labels si hace falta
apps/clickaton/lib/admin/partners/**                  # NUEVO adapters/actions
apps/clickaton/components/marathon/MarathonSponsors.tsx
apps/clickaton/data/public-marathons/prisma-source.ts # cargar sponsors reales
apps/clickaton/types/marathon.ts                      # map desde dominio
apps/clickaton/lib/promotions/**                      # link opcional promotionId
```

### Riesgos locales

- DB Clickatón separada vs suite.
- Confusión UX “Patrocinadores” vs “Mi cuenta MP partner”.

---

## 3. FotoOffice

### Estado actual

- Sin sponsors/beneficios comerciales.
- Memberships: `WorkspaceMembership`.
- Cursos: `discountPrice` (otro concepto).
- Caso de uso clave: **mostrar beneficios a socios SFPR / participantes Clickatón / membresías**.

### Integración propuesta

| Fase | Qué |
|------|-----|
| A | Read-only: listar `DnxBenefit` PUBLISHED cuya audience califica el usuario |
| A | Adapter eligibility: `ORGANIZATION_MEMBERS` / `ROLE_OR_MEMBERSHIP` / `EVENT_PARTICIPANTS` (vía API/consulta Clickatón o tabla puente) |
| B | UI “Beneficios para vos” en shell FotoOffice |
| C | Canje manual (marcar consumo) — cupo / perPersonLimit |
| — | FotoOffice **no** es owner del CRM global de partners en v1 |

### Archivos próximos (estimados)

```
apps/fotoffice/app/(shell)/**/beneficios/**           # NUEVO
apps/fotoffice/lib/partners/**                        # NUEVO eligibility adapter
packages/partners/src/eligibility.ts
```

### Riesgos locales

- Resolver “socio SFPR” requiere fuente de verdad de membresía (hoy enums fee huérfanos; puede ser org externa o Workspace).
- Cross-DB Clickatón participants si Clickatón no comparte DB.

---

## 4. FotoRank

### Estado actual

- `sponsorsText` textarea.
- Premios/recompensas estructurados en JSON con `sponsorName/Url/Logo`, tipos `SPONSOR_BENEFIT`, `DISCOUNT`, `COUPON`.
- Org: `ContestOrganization`.

### Integración propuesta

| Fase | Qué |
|------|-----|
| A | Participation scope CONTEST / CATEGORY vinculada a `ContestOrganization` / contestId |
| A | Bridge UI: elegir Partner existente en lugar de solo texto |
| B | Mantener `sponsorsText` como fallback/legacy hasta cutover |
| B | Contribution PRIZE alineada a `ContestPrizeItem` (sin romper diplomas/reglas) |
| C | Beneficios post-concurso para participantes (`EVENT_PARTICIPANTS`) |

### Archivos próximos (estimados)

```
apps/fotorank/app/lib/fotorank/prizesRewards.ts       # bridge tipado
apps/fotorank/app/(dashboard)/dashboard/concursos/[id]/modals/PremiosRecompensas*
apps/fotorank/app/(dashboard)/dashboard/concursos/[id]/modals/PublicacionModalContent.tsx
apps/fotorank/app/concursos/[slug]/ContestPublicLanding.tsx
```

---

## 5. ComprameLaFoto

### Estado actual

- CRUD real `OrganizerLandingSponsor` (scope landing organizador).
- Beneficios de pack / lab discounts / referral — otros dominios.
- No usa `@repo/promotions`.

### Integración propuesta

| Fase | Qué |
|------|-----|
| A | **No migrar** OrganizerLandingSponsor en v1 (sigue siendo display local del organizador) |
| B | Opción “vincular a DnxPartner” en sponsor de landing (logo canónico) |
| C | Beneficios partner visibles en landings / comunidad si audience califica |
| D | Evaluar adapter `@repo/promotions` para cupones album-scoped (independiente del CRM) |

### Riesgos locales

- No convertir sponsors de landing de un organizador en “partners DNX globales” sin confirmación humana.
- Evitar mezclar `BenefitDefinition` (pack) con `DnxBenefit`.

---

## 6. InfoSpot

### Estado actual

- Sin dominio comercial de sponsors.
- Medio editorial / perfiles.

### Integración propuesta

| Fase | Qué |
|------|-----|
| A | Ninguna obligatoriedad |
| B | Consumo editorial: menciones / fichas públicas de partners con `visibility=PUBLIC` |
| C | Canal `publishChannels` incluye INFOSPOT para difusión autorizada |

InfoSpot no administra el CRM; como máximo publica contenido autorizado.

---

## 7. Paquetes compartidos

| Package | Rol respecto a Partners |
|---------|-------------------------|
| `@repo/partners` (nuevo) | Dominio, eligibility, permissions |
| `@repo/db` | Persistencia Prisma |
| `@repo/promotions` | Códigos; link opcional |
| `@repo/payments` | Solo PaymentTerms / FI opcionales; **sin** onboarding obligatorio |
| `@repo/auth` | Identidad User para audiences y actors |
| `@repo/auth-guards` | Guards de sesión/workspace; no RBAC partner |

---

## 8. Elegibilidad — fuentes de datos por audience

| AudienceType | Fuente probable v1 |
|--------------|-------------------|
| ALL_USERS | Cualquier sesión User |
| ORGANIZATION_MEMBERS | `ContestOrganizationMember` / WorkspaceMembership / futura membresía SFPR |
| EVENT_PARTICIPANTS | `ClickatonRegistration` confirmada / `FotorankContestRegistration` |
| PRODUCT_BUYERS | Ítems de inscripción / order pagada |
| MANUAL_USERS | Tabla audience rows |
| ROLE_OR_MEMBERSHIP | `DnxUserProfile`, roles FO, grants |
| CUSTOM_FUTURE | No implementar |

Cada adapter declara honestamente si la fuente está disponible en su DB.

---

## 9. Matriz de ownership

| Dato | Owner canónico | Consumidores |
|------|----------------|--------------|
| Ficha Partner | Suite / admin DNX (Clickatón ops v1) | Todas las apps |
| Participation | App + contexto | App dueña del contexto |
| Benefit | Suite (publicado) | FotoOffice, Clickatón, FR, … |
| Promotion code | `@repo/promotions` + app que lo crea | Checkout apps |
| PaymentTerms | Ops + finance grants | Solo internos |
| OrganizerLandingSponsor | Organizador CLF | Landing pública CLF |
| Finance MP Partner | `@repo/payments` | Finanzas Clickatón |

---

## 10. Anti-acoplamientos (checklist de diseño)

- [ ] UI “Sponsors y beneficios” ≠ UI “Conectar Mercado Pago”.
- [ ] `DnxPartner` ≠ `ContestOrganization` ≠ `Workspace` ≠ `CommunityProfile`.
- [ ] `DnxBenefit` ≠ `BenefitDefinition` ≠ `ClickatonUserEntitlement`.
- [ ] Publicar beneficio no crea cobro ni preferencia MP.
- [ ] Apps leen ficha por ID; no copian logo/nombre a tablas propias salvo cache de display documentada.
- [ ] `@repo/partners` no importa `apps/*`.
- [ ] payments no depende de partners en v1.
