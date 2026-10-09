# Aplicar la migración de Etapa 5 · Contratos (FOTOFFICE)

Procedimiento manual, con el mismo criterio que `MIGRACION-ETAPA-4-AGENDA.md`, **sin staging**: el SQL va
directo a la base de producción de FOTOFFICE y **antes** que el código. **Esta migración todavía NO se aplicó a
ninguna base.**

Qué hace: crea las tablas del módulo **Contratos** (plantillas, contratantes del pedido, contratos, versiones
enviadas, firmantes, bitácora y ajustes) y reemplaza el CHECK de `FotofficeMessageTemplate.entityType`
(se mantienen `GENERAL`, `CLIENTE`, `SOCIO`, `CONSULTA`, `PRESUPUESTO`, `PEDIDO`, `PROYECTO` y `CITA`, y se suma
`CONTRATO`). No suma columnas a tablas existentes, no borra ni actualiza filas. Con el SQL aplicado y el código
viejo publicado no pasa nada.

## 1. Qué se aplica

Migración: `packages/db/prisma/migrations/20261027120000_fotoffice_etapa_5_contratos/migration.sql`

Checksum SHA-256 del archivo comprometido:

```
e4096b699c19717372dde5401d6140e94f30deefeecb0736b32f7aa287e09939
```

Comprobar antes de pegar: `shasum -a 256 packages/db/prisma/migrations/20261027120000_fotoffice_etapa_5_contratos/migration.sql`.
Si el archivo se toca, recalcular el checksum acá y en el paso 2.

### Tablas nuevas (7)

| Tabla | Para qué |
|---|---|
| `FotofficeContratoPlantilla` | Plantillas de contrato por organización (único por workspace y nombre). |
| `FotofficePedidoContratante` | Quién contrata un pedido: orden 1 o 2 (único por pedido y orden). |
| `FotofficeContrato` | El contrato: estado, texto, versión vigente, PDF final y firma en papel. |
| `FotofficeContratoVersion` | Texto congelado al enviar y su huella SHA-256. |
| `FotofficeContratoFirmante` | Quién firma cada versión: enlace y código (sólo hashes), evidencia y firma. |
| `FotofficeContratoEvento` | Bitácora del contrato. Nunca guarda el código de verificación. |
| `FotofficeContratoAjustes` | Una fila por organización: datos de la empresa, cláusula y recordatorio. |

## 2. Aplicar

1. Verificar el checksum.
2. Pegar el SQL en la consola SQL de la rama de producción de FOTOFFICE.
3. Registrar: `prisma migrate resolve --applied 20261027120000_fotoffice_etapa_5_contratos` (con el checksum de arriba).
4. Verificar: las 7 tablas existen y `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'FotofficeMessageTemplate_entityType'` incluye `CONTRATO`.
