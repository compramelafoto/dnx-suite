# Clickaton — Arquitectura pública y contrato funcional

## 1. Qué pertenece a Clickaton

- Marca pública y experiencia de usuario
- Contenido editorial e institucional
- Comunidad y comunicación
- Presentación de maratones
- Red de sedes (presentación)
- Sponsors y alianzas (presentación)
- Tienda futura y merchandising (backlog)
- Navegación y SEO público

## 2. Qué pertenece a FotoRank

- Motor de competencias / eventos
- Inscripciones y participantes
- Jurados, categorías, rankings y resultados
- Fotografías presentadas
- Validaciones GPS / EXIF cuando corresponda
- Fuente de verdad operativa de cada edición

## 3. Qué pertenece a DNX Identity

- Autenticación y cuenta de participante / organizador
- Sesión compartida del ecosistema DNX (futuro)

## 4. Qué pertenece a DNX Payments

- Cobros, liquidaciones y distribución de fondos (futuro)
- Integraciones de pago (p. ej. Mercado Pago) vía capa DNX

## 5. Qué pertenece a ComprameLaFoto

- Producto de venta fotográfica de eventos (ecosistema hermano)
- No es el frontend de Clickaton ni el motor de maratones

## 6. Rutas públicas

| Ruta | Rol |
|------|-----|
| `/` | Home de lanzamiento |
| `/maratones` | Catálogo / prelanzamiento |
| `/maratones/[slug]` | Ficha pública de edición |
| `/maratones/demo` | Fixture técnico (`isDemo`, noindex) |
| `/como-funciona` | Experiencia completa |
| `/comunidad` | Dimensión comunitaria y pedagógica |
| `/organizar` | Programa de sedes (en desarrollo) |
| `/sponsors` | Alianzas (sin paquetes comerciales) |
| `/nosotros` | Origen prudente |
| `/contacto` | Contacto sin canales inventados |
| `/design-system` | Catálogo interno (`noindex`) |

**No creadas todavía:** tienda, blog, ranking, galería dedicada, hall de la fama, perfil, login, checkout, paneles.

## 7. Navegación principal

Header: Inicio · Maratones · Cómo funciona · Comunidad · Organizá una · Sponsors · CTA “Ver maratones”.

Footer: mismas + Nosotros · Contacto.

Fuente única: `config/navigation.ts` (`routes`). La demo **no** entra al nav principal.

## 8. Entidades visibles

Maratón pública, organizador, sede local, categorías, cronograma, premios, jurado, sponsors, FAQ, bases, política de validaciones, estados de resultados/galería.

## 9. Modelo funcional

Tipos estructurales: `apps/clickaton/types/marathon.ts` (`PublicMarathon` + relacionados de ficha).

Contratos satélite (Etapa 05A): `apps/clickaton/types/public/*` — inscripción, elegibilidad, capacidades, cupos, resultados, galería, ventanas, versionado, avisos, reglas de validación.

Documento: [FOTORANK_INTEGRATION_CONTRACT.md](./FOTORANK_INTEGRATION_CONTRACT.md).

Catálogo local estructural: `content/demo-marathon.ts` · acceso: `lib/marathons.ts`.

## 10. Estados públicos

- `MarathonStatus`: draft → announced → registration_* → in_progress → judging → results_published → archived / cancelled
- `RegistrationStatus`: unavailable, coming_soon, open, last_places, full, closed, cancelled
- `MarathonFormat`: individual, team, mixed
- `AllowedDevice`: smartphone, camera, drone

Etiquetas de UI en el mismo archivo (`*Labels`).

## 11. Información por momento

| Momento | Visible |
|---------|---------|
| Antes | Nombre, territorio, fechas, estado inscripción, formato, bases, categorías, cronograma público |
| Durante | Estado en curso, deadlines públicos, consignas liberadas |
| Después | Resultados / galería si publicadas |

## 12. Qué permanece oculto

- Consignas no liberadas (`lib/challenges.ts`)
- Ítems de cronograma con `publicBeforeEvent=false` (antes del evento)
- Datos personales de participantes
- Criterios internos de jurado no publicados
- Condiciones económicas de sedes/sponsors no aprobadas
- Credenciales y paneles

## 13. Contrato futuro Clickaton ↔ FotoRank

Documento detallado: [FOTORANK_INTEGRATION_CONTRACT.md](./FOTORANK_INTEGRATION_CONTRACT.md).

```
Clickaton
  → presenta evento (datos públicos de FotoRank)
  → inicia inscripción (flujo FotoRank + DNX Identity)
  → pagos (DNX Payments)
  → vuelve a experiencia / resultados en Clickaton
```

## 14. Pendientes

Ver `BACKLOG.md` (inscripción, sedes reales, sponsors reales, legales, contacto, redes, tienda, API FotoRank, etc.).

## 15. Decisiones abiertas

- Relato fundacional y presentación de socios
- Canales oficiales de contacto
- Production branch / deploys automáticos
- Cuándo activar indexación
- Momento de revelación de consignas por edición
- URL canónica de inscripción FotoRank
