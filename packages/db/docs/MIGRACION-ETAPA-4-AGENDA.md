# Aplicar la migración de Etapa 4 · Agenda (FOTOFFICE, Entrega B)

Procedimiento manual, **sin staging**: el SQL va directo a la base de producción de FOTOFFICE, **antes** que el
código (no se fusiona el PR sin haberlo aplicado). **Esta migración todavía NO se aplicó a ninguna base.**

## Qué hace

Crea seis tablas nuevas: `FotofficeCitaTipo`, `FotofficeCita`, `FotofficeCitaParticipante`,
`FotofficeProductoCita`, `FotofficeAgendaAjustes` y `FotofficeCitaRecordatorio`. Reemplaza el CHECK de
`FotofficeMessageTemplate.entityType` (conserva `GENERAL`, `CLIENTE`, `SOCIO`, `CONSULTA`, `PRESUPUESTO`,
`PEDIDO`, `PROYECTO` y suma `CITA`). No suma columnas a tablas existentes, no borra ni actualiza filas.

## Advertencia

Con el módulo `agenda` encendido, confirmar un pedido lee `FotofficeProductoCita` y puede escribir
`FotofficeCita`; la ficha del producto lee las reglas. Si el código sale antes que el SQL, esas lecturas fallan
(`P2021`). Con el SQL aplicado y el código viejo no pasa nada.

## Aplicar

1. Correr `packages/db/prisma/migrations/20261026120000_fotoffice_etapa_4_agenda/migration.sql` en la base de
   FOTOFFICE (rama "development" de Neon), en una sola transacción.
2. Registrarla: `prisma migrate resolve --applied 20261026120000_fotoffice_etapa_4_agenda` (con el checksum del
   archivo tal como está en `main`).
3. Verificar: las seis tablas existen y `\d "FotofficeCita"` muestra los CHECK `status`, `rango` y `title`.

## Deshacer

Sin datos cargados: `DROP TABLE` de las seis tablas y volver a poner el CHECK de plantillas sin `'CITA'`.
