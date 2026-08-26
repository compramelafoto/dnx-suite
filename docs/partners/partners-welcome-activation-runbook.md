# Sponsor Global — Runbook primera activación (NO EJECUTAR en Etapa 7)

**Estado:** preparado · **no ejecutado**  
**Prerrequisito Etapa 7:** veredicto `READY` + `DNX_PARTNERS_FOTORANK_DATABASE_URL` en Production Clickatón + fingerprints alineados.

## Principio

Una sola plataforma · un solo contexto · un solo sponsor · vigencia corta · flag OFF hasta smoke · rollback inmediato.

## 1. Precondiciones

- [ ] Flags welcome nuevos OFF en Production.
- [ ] Etapa 7 `READY`.
- [ ] Selectores FR/CLF/CK con conexiones canónicas configuradas.
- [ ] Sin campañas welcome ACTIVE inesperadas.
- [ ] Sponsor, asset y creative listos en admin (asset **APPROVED** formal).
- [ ] Ventana de monitoreo acordada.

## 2. Sponsor

Elegir un sponsor ACTIVE de prueba controlada (no decidir en E7).

## 3. Asset

Asset del mismo sponsor, APPROVED, alt, PNG/WebP/JPG, URL segura. No SVG. No PENDING.

## 4. Campaña

DRAFT → creative `WELCOME_INTERSTITIAL` APPROVED → destination URL segura → vigencia corta → prioridad conocida.

## 5. Contexto

Un solo alcance contextual (recomendado: Clickatón EVENT o FR CONTEST o CLF ALBUM). ID canónico vía selector (nunca slug).

## 6. Placement

Solo montado: `CLICKATON_EVENT_WELCOME` | `FOTORANK_CONTEST_WELCOME` | `CLF_ALBUM_WELCOME` | `INFOSPOT_HOME_WELCOME`.

## 7. Publicación

Targets multi-DB solo si la app lo requiere (IS/CLF). Snapshot mínimo. FotoOffice ausente.

## 8. Sync

Verificar SYNCED / reintentar FAILED. No activar flag si sync falló.

## 9. Flag

Activar **solo** el flag de la superficie elegida (y kill switch CLF ads si álbum).

## 10. Smoke

Abrir landing pública del contexto · 1 impresión · 1 clic · dismiss · frequency 24h. Sin checkout/inscripción/carga.

## 11. Monitoreo

Analytics por app/placement/campaña · errores 5xx · sync.

## 12. Pausa

Pausar campaña en admin.

## 13. Flag OFF

Desactivar flag(s) de la superficie.

## 14. Rollback

Pausa + flag OFF + (si hace falta) desactivar binding placement. No migraciones. No tocar OrganizerLandingSponsor.

## 15. Impacto transaccional

Confirmar 0 cambios en pagos, órdenes, inscripciones, álbumes reales fuera del alcance.

---

**No ejecutar este runbook en Etapa 7.**
