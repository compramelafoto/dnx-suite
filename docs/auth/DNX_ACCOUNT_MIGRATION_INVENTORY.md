# Inventario de migración de cuentas (10B.5)

Complementa `DNX_IDENTITY_MIGRATION_INVENTORY.md`.

## Fuentes a inventariar (Staging)

| Origen | DB | Acción |
| ------ | -- | ------ |
| ComprameLaFoto / suite | DB identidad | Canónica |
| FotoRank | misma | Canónica + jueces aparte |
| Clickatón | Neon propia | Fusionar a canónica tras backup |
| InfoSpot / FotoOffice | suite | Canónica |

## Campos por fila (sin hashes)

`id`, `email_norm`, `has_password`, `hash_type` (bcrypt|scrypt|none), `email_verified`, `has_google`, `role`, `source_guess`, `mp_legacy`, `conflict_class`

## Clases

| Clase | Acción |
| ----- | ------ |
| AUTO_SAFE | Reutilizar id canónico |
| REHASH_ON_LOGIN | bcrypt → scrypt al login |
| LINK_GOOGLE_SAFE | Vincular subject |
| RESET_REQUIRED | hash unknown |
| MANUAL_CONFLICT | revisión humana |
| DB_DUPLICATE | Clickatón vs suite — alias |

## Estado

Queries cuantitativas **pendientes** de ejecución contra Staging (requiere credenciales + ADR-002 deploy de topología).
